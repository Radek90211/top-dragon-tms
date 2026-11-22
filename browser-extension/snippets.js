(() => {
  if(globalThis.__tdSnippets)return;
  globalThis.__tdSnippets=true;
  let templates={'=1':'TEST'},pending=null;
  const chromeAPI=globalThis.chrome?.storage;
  function read(data){const raw=data?.tdSnippets;if(raw&&typeof raw==='object')templates=Object.fromEntries(Object.entries(raw).filter(([key,val])=>/^=[a-z0-9]{1,8}$/i.test(key)&&typeof val==='string'&&val.length<=4000));}
  chromeAPI?.sync.get('tdSnippets').then(read).catch(()=>{});
  chromeAPI?.onChanged.addListener((changes,area)=>{if(area==='sync'&&changes.tdSnippets)read({tdSnippets:changes.tdSnippets.newValue});});
  const reset=()=>{pending=null;};
  document.addEventListener('pointerdown',reset,true);
  document.addEventListener('focusout',reset,true);
  document.addEventListener('compositionstart',reset,true);
  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.key.length!==1)reset();},true);
  function editable(event){
    const element=event.composedPath?.().find(item=>item instanceof Element)||event.target;
    if(!(element instanceof Element)||element.closest('[contenteditable="false"]'))return null;
    if(element instanceof HTMLTextAreaElement)return element.readOnly||element.disabled?null:element;
    if(element instanceof HTMLInputElement)return ['text','search'].includes(element.type)&&!element.readOnly&&!element.disabled?element:null;
    return element.closest('[contenteditable="true"],[contenteditable="plaintext-only"]');
  }
  document.addEventListener('beforeinput',event=>{
    if(event.defaultPrevented||event.isComposing||event.inputType!=='insertText'||!event.data||event.data.length!==1)return reset();
    const field=editable(event);if(!field)return reset();
    if(event.data==='='){pending={field,text:'=',at:Date.now()};return;}
    if(!pending||pending.field!==field||Date.now()-pending.at>3000)return reset();
    const trigger=pending.text+event.data;
    const replacement=templates[trigger];
    if(replacement===undefined){
      if(Object.keys(templates).some(key=>key.startsWith(trigger))){pending.text=trigger;pending.at=Date.now();return;}
      return reset();
    }
    if(!event.cancelable)return reset();
    const prefix=trigger.slice(0,-1);
    if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement){
      const start=field.selectionStart,end=field.selectionEnd;
      if(start===null||start!==end||field.value.slice(start-prefix.length,start)!==prefix)return reset();
      const value=field.value.slice(0,start-prefix.length)+replacement+field.value.slice(end);
      if(field.maxLength>=0&&value.length>field.maxLength)return reset();
      event.preventDefault();
      const proto=field instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(field,value);
      field.setSelectionRange(start-prefix.length+replacement.length,start-prefix.length+replacement.length);
    }else{
      const selection=field.ownerDocument.getSelection();
      if(!selection?.isCollapsed||!selection.rangeCount)return reset();
      const range=selection.getRangeAt(0);
      if(!field.contains(range.startContainer)||range.startContainer.nodeType!==Node.TEXT_NODE||range.startOffset<prefix.length)return reset();
      if(range.startContainer.textContent.slice(range.startOffset-prefix.length,range.startOffset)!==prefix)return reset();
      event.preventDefault();
      range.setStart(range.startContainer,range.startOffset-prefix.length);
      range.deleteContents();
      const text=field.ownerDocument.createTextNode(replacement);range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
    }
    field.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertReplacementText',data:replacement}));
    reset();
  },true);
})();

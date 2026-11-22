async function tdHighlightClients(names) {
  if(!globalThis.CSS?.highlights||!globalThis.Highlight)return {count:0,message:'Ta przeglądarka nie obsługuje wyróżniania tekstu.'};
  const rules=names.filter(name=>typeof name==='string'&&name.trim().length>=3).slice(0,30);
  const ranges=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let node,seen=0;
  while((node=walker.nextNode())&&seen++<15000){
    if(seen%300===0)await new Promise(resolve=>setTimeout(resolve,0));
    if(node.parentElement?.closest('input,textarea,[contenteditable],script,style,noscript'))continue;
    const text=node.textContent.toLocaleLowerCase('pl');
    for(const name of rules){let offset=0,index;const key=name.toLocaleLowerCase('pl');
      while((index=text.indexOf(key,offset))!==-1){const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+key.length);ranges.push(range);offset=index+key.length;if(ranges.length>=500)break;}
      if(ranges.length>=500)break;
    }
    if(ranges.length>=500)break;
  }
  CSS.highlights.set('top-dragon-clients',new Highlight(...ranges));
  return {count:ranges.length,truncated:seen>=15000};
}

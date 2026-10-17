-- Nowe profile nie dostają automatycznego dostępu do modułów TMS.
-- Istniejące profile zachowują zapisane uprawnienia.
alter table public.profiles
  alter column feature_permissions set default jsonb_build_object(
    'routeOptimization', false,
    'routeHistory', false,
    'multiVehicleProjects', false,
    'militaryTransport', false,
    'statistics', false,
    'loadRequests', false,
    'nearbyClients', false,
    'plannedRelations', false,
    'freeLoads', false,
    'relationChat', false,
    'clientDatabase', false,
    'excelBoardMode', false
  );

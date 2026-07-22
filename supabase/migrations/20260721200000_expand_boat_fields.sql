-- Ficha ampliada del barco: construcción, registro/amarra y handicap.
-- Todos los campos son opcionales; `category` (la clase de vela) sigue
-- siendo el único dato que decide la elegibilidad en regatas.

alter table public.boats
  -- Construcción
  add column builder text
    check (builder is null or char_length(builder) between 1 and 100),
  add column model text
    check (model is null or char_length(model) between 1 and 100),
  add column designer text
    check (designer is null or char_length(designer) between 1 and 100),
  -- Sin tope duro por año actual: un CHECK con now() no es inmutable y
  -- rompería restores. 2100 alcanza de sobra como cota superior.
  add column year_built smallint
    check (year_built is null or year_built between 1800 and 2100),
  add column hull_material text
    check (
      hull_material is null
      or hull_material in ('Fibra', 'Madera', 'Aluminio', 'Acero', 'Carbono', 'Otro')
    ),

  -- Registro y amarra
  add column registration_number text
    check (registration_number is null or char_length(registration_number) between 1 and 50),
  add column home_port text
    check (home_port is null or char_length(home_port) between 1 and 100),
  -- Código ISO 3166-1 alfa-2 en mayúsculas (UY, AR, ES…).
  add column flag text
    check (flag is null or flag ~ '^[A-Z]{2}$'),

  -- Handicap de regata
  add column rating_system text
    check (
      rating_system is null
      or rating_system in ('ORC', 'IRC', 'PHRF', 'Otro')
    ),
  -- Cubre GPH de ORC (~600), TCC de IRC (~1.050) y segundos/milla de PHRF.
  add column rating_value numeric(8, 3)
    check (rating_value is null or rating_value >= 0),
  add column crew_capacity smallint
    check (crew_capacity is null or crew_capacity between 1 and 50);

-- El valor de rating no significa nada sin saber de qué sistema es.
alter table public.boats
  add constraint boats_rating_value_needs_system
  check (rating_value is null or rating_system is not null);

comment on column public.boats.category is
  'Clase de vela (Snipe, ILCA, J/24…). Es la que debe coincidir con regatta_classes.sailing_class para poder inscribirse.';
comment on column public.boats.model is
  'Modelo o proyecto del casco (ej: "Beneteau First 36.7"). Distinto de la clase.';
comment on column public.boats.flag is 'Código ISO 3166-1 alfa-2 en mayúsculas.';

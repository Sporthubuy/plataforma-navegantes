/**
 * Datos geográficos locales. No se consulta ninguna API externa: el
 * listado de países se generó con `Intl.DisplayNames` en español y las
 * localidades de Uruguay están precargadas a mano.
 *
 * Fuera de Uruguay la ciudad se escribe libre — ver `hasCities()`.
 */

export interface Country {
  /** ISO 3166-1 alfa-2. */
  code: string;
  name: string;
}

/** País por defecto de la plataforma. */
export const DEFAULT_COUNTRY = 'UY';

export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afganistán' },
  { code: 'AL', name: 'Albania' },
  { code: 'DE', name: 'Alemania' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguila' },
  { code: 'AQ', name: 'Antártida' },
  { code: 'AG', name: 'Antigua y Barbuda' },
  { code: 'SA', name: 'Arabia Saudí' },
  { code: 'DZ', name: 'Argelia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaiyán' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BD', name: 'Bangladés' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BH', name: 'Baréin' },
  { code: 'BE', name: 'Bélgica' },
  { code: 'BZ', name: 'Belice' },
  { code: 'BJ', name: 'Benín' },
  { code: 'BM', name: 'Bermudas' },
  { code: 'BY', name: 'Bielorrusia' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia y Herzegovina' },
  { code: 'BW', name: 'Botsuana' },
  { code: 'BR', name: 'Brasil' },
  { code: 'BN', name: 'Brunéi' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'BT', name: 'Bután' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Camboya' },
  { code: 'CM', name: 'Camerún' },
  { code: 'CA', name: 'Canadá' },
  { code: 'BQ', name: 'Caribe neerlandés' },
  { code: 'QA', name: 'Catar' },
  { code: 'TD', name: 'Chad' },
  { code: 'CZ', name: 'Chequia' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CY', name: 'Chipre' },
  { code: 'VA', name: 'Ciudad del Vaticano' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoras' },
  { code: 'CG', name: 'Congo' },
  { code: 'KP', name: 'Corea del Norte' },
  { code: 'KR', name: 'Corea del Sur' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: 'Côte d’Ivoire' },
  { code: 'HR', name: 'Croacia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CW', name: 'Curazao' },
  { code: 'DK', name: 'Dinamarca' },
  { code: 'DM', name: 'Dominica' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egipto' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'AE', name: 'Emiratos Árabes Unidos' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'SK', name: 'Eslovaquia' },
  { code: 'SI', name: 'Eslovenia' },
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Esuatini' },
  { code: 'ET', name: 'Etiopía' },
  { code: 'PH', name: 'Filipinas' },
  { code: 'FI', name: 'Finlandia' },
  { code: 'FJ', name: 'Fiyi' },
  { code: 'FR', name: 'Francia' },
  { code: 'GA', name: 'Gabón' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GD', name: 'Granada' },
  { code: 'GR', name: 'Grecia' },
  { code: 'GL', name: 'Groenlandia' },
  { code: 'GP', name: 'Guadalupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GF', name: 'Guayana Francesa' },
  { code: 'GG', name: 'Guernesey' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GQ', name: 'Guinea Ecuatorial' },
  { code: 'GW', name: 'Guinea-Bisáu' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haití' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungría' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IQ', name: 'Irak' },
  { code: 'IR', name: 'Irán' },
  { code: 'IE', name: 'Irlanda' },
  { code: 'BV', name: 'Isla Bouvet' },
  { code: 'IM', name: 'Isla de Man' },
  { code: 'CX', name: 'Isla de Navidad' },
  { code: 'NF', name: 'Isla Norfolk' },
  { code: 'IS', name: 'Islandia' },
  { code: 'AX', name: 'Islas Aland' },
  { code: 'KY', name: 'Islas Caimán' },
  { code: 'CC', name: 'Islas Cocos' },
  { code: 'CK', name: 'Islas Cook' },
  { code: 'FO', name: 'Islas Feroe' },
  { code: 'GS', name: 'Islas Georgia del Sur y Sandwich del Sur' },
  { code: 'HM', name: 'Islas Heard y McDonald' },
  { code: 'FK', name: 'Islas Malvinas' },
  { code: 'MP', name: 'Islas Marianas del Norte' },
  { code: 'MH', name: 'Islas Marshall' },
  { code: 'UM', name: 'Islas menores alejadas de EE. UU.' },
  { code: 'PN', name: 'Islas Pitcairn' },
  { code: 'SB', name: 'Islas Salomón' },
  { code: 'TC', name: 'Islas Turcas y Caicos' },
  { code: 'VG', name: 'Islas Vírgenes Británicas' },
  { code: 'VI', name: 'Islas Vírgenes de EE. UU.' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italia' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japón' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordania' },
  { code: 'KZ', name: 'Kazajistán' },
  { code: 'KE', name: 'Kenia' },
  { code: 'KG', name: 'Kirguistán' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'LA', name: 'Laos' },
  { code: 'LS', name: 'Lesoto' },
  { code: 'LV', name: 'Letonia' },
  { code: 'LB', name: 'Líbano' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lituania' },
  { code: 'LU', name: 'Luxemburgo' },
  { code: 'MK', name: 'Macedonia del Norte' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MY', name: 'Malasia' },
  { code: 'MW', name: 'Malaui' },
  { code: 'MV', name: 'Maldivas' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MA', name: 'Marruecos' },
  { code: 'MQ', name: 'Martinica' },
  { code: 'MU', name: 'Mauricio' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'México' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldavia' },
  { code: 'MC', name: 'Mónaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar (Birmania)' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Níger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'NO', name: 'Noruega' },
  { code: 'NC', name: 'Nueva Caledonia' },
  { code: 'NZ', name: 'Nueva Zelanda' },
  { code: 'OM', name: 'Omán' },
  { code: 'NL', name: 'Países Bajos' },
  { code: 'PK', name: 'Pakistán' },
  { code: 'PW', name: 'Palaos' },
  { code: 'PA', name: 'Panamá' },
  { code: 'PG', name: 'Papúa Nueva Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Perú' },
  { code: 'PF', name: 'Polinesia Francesa' },
  { code: 'PL', name: 'Polonia' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'HK', name: 'RAE de Hong Kong (China)' },
  { code: 'MO', name: 'RAE de Macao (China)' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'CF', name: 'República Centroafricana' },
  { code: 'CD', name: 'República Democrática del Congo' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'RE', name: 'Reunión' },
  { code: 'RW', name: 'Ruanda' },
  { code: 'RO', name: 'Rumanía' },
  { code: 'RU', name: 'Rusia' },
  { code: 'EH', name: 'Sáhara Occidental' },
  { code: 'WS', name: 'Samoa' },
  { code: 'AS', name: 'Samoa Americana' },
  { code: 'BL', name: 'San Bartolomé' },
  { code: 'KN', name: 'San Cristóbal y Nieves' },
  { code: 'SM', name: 'San Marino' },
  { code: 'MF', name: 'San Martín' },
  { code: 'PM', name: 'San Pedro y Miquelón' },
  { code: 'VC', name: 'San Vicente y las Granadinas' },
  { code: 'SH', name: 'Santa Elena' },
  { code: 'LC', name: 'Santa Lucía' },
  { code: 'ST', name: 'Santo Tomé y Príncipe' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leona' },
  { code: 'SG', name: 'Singapur' },
  { code: 'SX', name: 'Sint Maarten' },
  { code: 'SY', name: 'Siria' },
  { code: 'SO', name: 'Somalia' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'ZA', name: 'Sudáfrica' },
  { code: 'SD', name: 'Sudán' },
  { code: 'SS', name: 'Sudán del Sur' },
  { code: 'SE', name: 'Suecia' },
  { code: 'CH', name: 'Suiza' },
  { code: 'SR', name: 'Surinam' },
  { code: 'SJ', name: 'Svalbard y Jan Mayen' },
  { code: 'TH', name: 'Tailandia' },
  { code: 'TW', name: 'Taiwán' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TJ', name: 'Tayikistán' },
  { code: 'IO', name: 'Territorio Británico del Océano Índico' },
  { code: 'TF', name: 'Territorios Australes Franceses' },
  { code: 'PS', name: 'Territorios Palestinos' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad y Tobago' },
  { code: 'TN', name: 'Túnez' },
  { code: 'TM', name: 'Turkmenistán' },
  { code: 'TR', name: 'Turquía' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UA', name: 'Ucrania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistán' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'WF', name: 'Wallis y Futuna' },
  { code: 'YE', name: 'Yemen' },
  { code: 'DJ', name: 'Yibuti' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabue' },
];

/**
 * Localidades de Uruguay agrupadas por departamento. Prioriza las de
 * interés náutico (costa, río y balnearios) además de cada capital
 * departamental.
 */
export const UY_LOCALITIES: Record<string, string[]> = {
  Artigas: ['Artigas', 'Bella Unión'],
  Canelones: [
    'Atlántida',
    'Canelones',
    'Ciudad de la Costa',
    'La Floresta',
    'Las Piedras',
    'Pando',
    'Parque del Plata',
    'Salinas',
    'Santa Lucía',
    'Shangrilá',
    'Solymar',
  ],
  'Cerro Largo': ['Melo', 'Río Branco'],
  Colonia: [
    'Carmelo',
    'Colonia del Sacramento',
    'Conchillas',
    'Juan Lacaze',
    'Nueva Helvecia',
    'Nueva Palmira',
    'Rosario',
  ],
  Durazno: ['Durazno', 'Sarandí del Yí'],
  Flores: ['Trinidad'],
  Florida: ['Florida', 'Sarandí Grande'],
  Lavalleja: ['José Pedro Varela', 'Minas'],
  Maldonado: [
    'Aiguá',
    'José Ignacio',
    'La Barra',
    'Maldonado',
    'Pan de Azúcar',
    'Piriápolis',
    'Punta Ballena',
    'Punta del Este',
    'San Carlos',
    'Solís',
  ],
  Montevideo: ['Montevideo'],
  Paysandú: ['Guichón', 'Paysandú'],
  'Río Negro': ['Fray Bentos', 'Nuevo Berlín', 'San Javier', 'Young'],
  Rivera: ['Rivera', 'Tranqueras'],
  Rocha: [
    'Aguas Dulces',
    'Barra de Valizas',
    'Cabo Polonio',
    'Castillos',
    'Chuy',
    'La Paloma',
    'La Pedrera',
    'Lascano',
    'Punta del Diablo',
    'Rocha',
  ],
  Salto: ['Constitución', 'Salto'],
  'San José': [
    'Ciudad del Plata',
    'Kiyú',
    'Libertad',
    'Playa Pascual',
    'San José de Mayo',
  ],
  Soriano: ['Dolores', 'Mercedes', 'Palmitas', 'Villa Soriano'],
  Tacuarembó: ['Paso de los Toros', 'Tacuarembó'],
  'Treinta y Tres': ['Santa Clara de Olimar', 'Treinta y Tres', 'Vergara'],
};

/** Países con localidades precargadas: para el resto la ciudad es libre. */
const COUNTRIES_WITH_CITIES: Record<string, Record<string, string[]>> = {
  UY: UY_LOCALITIES,
};

export function hasCities(countryCode: string): boolean {
  return countryCode in COUNTRIES_WITH_CITIES;
}

/** Localidades del país agrupadas por región, o null si no hay lista. */
export function citiesByRegion(
  countryCode: string
): Record<string, string[]> | null {
  return COUNTRIES_WITH_CITIES[countryCode] ?? null;
}

/** Todas las localidades del país en una sola lista ordenada. */
export function citiesOf(countryCode: string): string[] {
  const byRegion = citiesByRegion(countryCode);
  if (!byRegion) return [];
  return Object.values(byRegion).flat().sort(new Intl.Collator('es').compare);
}

export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** "Punta del Este, Uruguay" — omite las partes que falten. */
export function formatLocation(
  city: string | null | undefined,
  country: string | null | undefined
): string {
  return [city, countryName(country)].filter(Boolean).join(', ');
}

/** Emoji de bandera a partir del ISO alfa-2. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/**
 * Etiqueta corta de un lugar. Si hay club, manda el club (ya dice dónde
 * es); si no, "Ciudad, País". Devuelve '' si no hay nada que mostrar.
 */
export function placeLabel(place: {
  club?: { name: string } | null;
  city?: string | null;
  country?: string | null;
}): string {
  if (place.club?.name) return place.club.name;
  return formatLocation(place.city, place.country);
}

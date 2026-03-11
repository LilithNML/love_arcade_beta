/**
 * WORD HUNT - Configuración de Niveles
 * LoveArcade Integration
 * 
 * Cada nivel incluye:
 * - id: Identificador único
 * - title: Nombre descriptivo
 * - gridSize: Tamaño de la cuadrícula (mínimo 10x10)
 * - words: Array de palabras a encontrar
 * - rewardCoins: Monedas otorgadas al completar
 *
 * --- CRITERIOS DE RECOMPENSA APLICADOS ---
 * Básica  (Easy):   10x10, 5-6 palabras      → 100-125
 * Media   (Medium): 11x11, 6-8 palabras      → 130-175
 * Avanzada (Hard):  12x12, 8-10 palabras     → 180-225
 * Maestra / Hito:   12x12+, 10+ palabras     → 230-250
 * Bonus +20: nivel contiene palabras de más de 8 caracteres
 * Técnica: Programación / Ciencia / Filosofía → 200-250
 * Hito cada 10 niveles                        → 250
 */

window.LA_WS_LEVELS = [
    {
        id: "lvl_01",
        title: "Genshin Impact",
        gridSize: 10,
        words: ["VENTI", "ZHONGLI", "RAIDEN", "NAHIDA", "FURINA"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_02",
        title: "Zenless Zone Zero",
        gridSize: 10,
        words: ["BILLY", "ANBY", "NICOLE", "ELLEN", "LYCAON"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_03",
        title: "NieR Automata",
        gridSize: 10,
        words: ["YORHA", "PASCAL", "ADAM", "EMIL", "PODO"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_04",
        title: "Dragon Ball",
        gridSize: 11,
        words: ["GOKU", "VEGETA", "GOHAN", "PICCOLO", "FREEZER", "TRUNKS"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_05",
        title: "Five Nights Freddy",
        gridSize: 10,
        words: ["FREDDY", "BONNIE", "CHICA", "FOXY", "GOLDEN"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_06",
        title: "Steven Universe",
        gridSize: 11,
        words: ["STEVEN", "GARNET", "PERLA", "AMATISTA", "LAPIS", "CONNIE"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_07",
        title: "Bocchi the Rock",
        gridSize: 10,
        words: ["HITORI", "NIJIKA", "RYO", "IKUYO", "ROCK", "BANDA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_08",
        title: "Sonic the Hedgehog",
        gridSize: 12,
        words: ["SONIC", "TAILS", "KNUCKLES", "AMY", "EGGMAN", "SHADOW", "SILVER"],
        rewardCoins: 180 // Avanzada: 12x12, 7 palabras
    },
    {
        id: "lvl_09",
        title: "Angry Birds",
        gridSize: 10,
        words: ["RED", "CHUCK", "BOMB", "STELLA", "CERDO", "HUEVO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_10",
        title: "Filosofía",
        gridSize: 11,
        words: ["PLATON", "SENECA", "KANT", "HEGEL", "LOGICA", "ETICA", "DUDA"],
        rewardCoins: 250 // HITO nivel 10 → máxima recompensa
    },
    {
        id: "lvl_11",
        title: "Mitología Griega",
        gridSize: 12,
        words: ["ZEUS", "HERA", "APOLO", "ATENEA", "HERMES", "HADES", "ARES", "CRONOS"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_12",
        title: "Arte Moderno",
        gridSize: 10,
        words: ["DALÍ", "PICASSO", "MUSEO", "LIENZO", "PINCEL", "OLEO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_13",
        title: "Naturaleza",
        gridSize: 11,
        words: ["BOSQUE", "SELVA", "DESIERTO", "PRADO", "VALLE", "COSTA"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_14",
        title: "Animales Marinos",
        gridSize: 10,
        words: ["BALLENA", "DELFIN", "TIBURON", "PULPO", "RAYA", "MEDUSA", "CORAL", "PEZ"],
        rewardCoins: 150 // Entre media y avanzada: 10x10 con 8 palabras
    },
    {
        id: "lvl_15",
        title: "Colores Vivos",
        gridSize: 10,
        words: ["VIOLETA", "CARMESI", "DORADO", "PLATA", "BRONCE", "TURQUESA", "VERDE"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_16",
        title: "Programación",
        gridSize: 12,
        words: ["PYTHON", "SCRIPT", "VARIABLE", "BUCLE", "DATOS", "CODIGO", "DEBUG", "CLASE", "ARRAY", "STRING"],
        rewardCoins: 250 // Maestra: 12x12, 10 palabras + temática técnica → máxima recompensa
    },
    {
        id: "lvl_17",
        title: "Star Wars",
        gridSize: 12,
        words: ["VADER", "YODA", "SKYWALKER", "LEIA", "KENOBI", "ANDOR", "AHSOKA", "SOLO"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + SKYWALKER (9 chars) → 180+20
    },
    {
        id: "lvl_18",
        title: "Postres Ricos",
        gridSize: 10,
        words: ["PASTEL", "HELADO", "FLAN", "DONA", "CHURRO", "MOUSSE", "CANELA"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_19",
        title: "Cine Clásico",
        gridSize: 11,
        words: ["ACTOR", "GUION", "CAMARA", "ESCENA", "PREMIO", "BUTACA", "RODAJE"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_20",
        title: "Harry Potter",
        gridSize: 12,
        words: ["HARRY", "RON", "HERMIONE", "SNAPE", "ALBUS", "DOBBY", "DRACO", "LUNA", "MAGIA"],
        rewardCoins: 250 // HITO nivel 20 → máxima recompensa
    },
    {
        id: "lvl_21",
        title: "Animales Salvajes",
        gridSize: 10,
        words: ["TIGRE", "CEBRA", "LEOPARDO", "JIRAFA", "HIENA"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_22",
        title: "Flores del Jardín",
        gridSize: 11,
        words: ["GIRASOL", "ROSA", "TULIPAN", "LIRIO", "CLAVEL", "DAHLIA"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_23",
        title: "Filosofía Griega",
        gridSize: 12,
        words: ["ETICA", "LOGICA", "VIRTUD", "RAZON", "MORAL", "ESTOICO", "IDEA"],
        rewardCoins: 200 // Avanzada: 12x12 + temática filosófica → rango técnico
    },
    {
        id: "lvl_24",
        title: "Arte y Pintura",
        gridSize: 10,
        words: ["CUBISMO", "MUSEO", "LIENZO", "OLEO", "PINCEL", "BOCETO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_25",
        title: "Genshin: Mondstadt",
        gridSize: 11,
        words: ["DILUC", "KLEE", "JEAN", "KAEYA", "LISA", "AMBER", "MONA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_26",
        title: "ZZZ: Facciones",
        gridSize: 12,
        words: ["BELOBOG", "VICTORIA", "LIEBRES", "PUB", "ENIER", "HOSHO"],
        rewardCoins: 180 // Avanzada: 12x12, 6 palabras (grid determina rango mínimo)
    },
    {
        id: "lvl_27",
        title: "NieR: Conceptos",
        gridSize: 10,
        words: ["GLORIA", "HUMANO", "PASCAL", "ADAM", "EVE", "EMIL"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_28",
        title: "Dragon Ball Z",
        gridSize: 11,
        words: ["SAIYAN", "FUSION", "KI", "CELULA", "BUU", "BROLY", "RADITZ"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_29",
        title: "FNAF: Seguridad",
        gridSize: 10,
        words: ["NOCHE", "GUARDIA", "MASCARA", "DUCTOS", "LUCES", "RELOJ"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_30",
        title: "Steven: Gemas",
        gridSize: 11,
        words: ["ZAFIRO", "RUBI", "JASPE", "PERIDOT", "BISMUTO", "OPALO"],
        rewardCoins: 250 // HITO nivel 30 → máxima recompensa
    },
    {
        id: "lvl_31",
        title: "Bocchi: Kessoku",
        gridSize: 10,
        words: ["HITORI", "NIJIKA", "KITA", "RYO", "BANDA", "SOLO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_32",
        title: "Sonic: Elementos",
        gridSize: 12,
        words: ["ANILLOS", "ESMERALDA", "CAOS", "VELOZ", "METAL", "BLAZE"],
        rewardCoins: 200 // Avanzada: 12x12 + ESMERALDA (9 chars) → 180+20
    },
    {
        id: "lvl_33",
        title: "Angry Birds: Items",
        gridSize: 10,
        words: ["RESORTE", "HUEVOS", "MADERA", "PIEDRA", "CRISTAL", "HONDA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_34",
        title: "Planetas",
        gridSize: 11,
        words: ["MERCURIO", "VENUS", "TIERRA", "MARTE", "JUPITER", "SATURNO"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_35",
        title: "Piedras Preciosas",
        gridSize: 12,
        words: ["DIAMANTE", "ESMERALDA", "TOPACIO", "OPALO", "AMATISTA", "TURMALINA"],
        rewardCoins: 200 // Avanzada: 12x12 + ESMERALDA (9) y TURMALINA (9) → 180+20
    },
    {
        id: "lvl_36",
        title: "Clima Extremo",
        gridSize: 10,
        words: ["HURACAN", "RAYO", "TRUENO", "NIEBLA", "SOL", "VIENTO", "NIEVE"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_37",
        title: "Mitología Nórdica",
        gridSize: 11,
        words: ["ODIN", "THOR", "LOKI", "FREYA", "FENRIR", "HELA", "VALHALA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_38",
        title: "Utensilios Cocina",
        gridSize: 12,
        words: ["SARTEN", "HORNO", "CUCHILLO", "OLLA", "PLATO", "VASO", "BATIDORA", "TABLA"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras (CUCHILLO=8, BATIDORA=8, no superan 8)
    },
    {
        id: "lvl_39",
        title: "Deportes Olímpicos",
        gridSize: 10,
        words: ["BOXEO", "GOLF", "SURF", "RUGBI", "REMO", "JUDO", "ESGRIMA"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_40",
        title: "Leyendas Gaming",
        gridSize: 12,
        words: ["MARIO", "LINK", "ZELDA", "KIRBY", "SAMUS", "DONKEY", "YOSHI", "FOX", "SNAKE", "CLOUD"],
        rewardCoins: 250 // HITO nivel 40 + Maestra: 12x12, 10 palabras → máxima recompensa
    },
    {
        id: "lvl_41",
        title: "Genshin: Liyue",
        gridSize: 11,
        words: ["XIAO", "GANU", "KEQING", "BEIDOU", "QIQI", "XINGQIU", "CHUNYUN"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_42",
        title: "ZZZ: Hollow Zero",
        gridSize: 10,
        words: ["ZETH", "PHAETHON", "PROXY", "ETHEREAL", "BANGBOO"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras (PHAETHON=8, ETHEREAL=8, no superan 8)
    },
    {
        id: "lvl_43",
        title: "NieR: Desierto",
        gridSize: 10,
        words: ["ARENA", "RUINAS", "CHASIS", "NIVEL", "NUCLEO", "MEMORIA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_44",
        title: "Dragon Ball: Villanos",
        gridSize: 12,
        words: ["CELL", "MAJINBUU", "COOLER", "BABIDI", "DABURA", "ZAMASU", "MORO"],
        rewardCoins: 180 // Avanzada: 12x12, 7 palabras (MAJINBUU=8, no supera 8)
    },
    {
        id: "lvl_45",
        title: "FNAF: Objetos",
        gridSize: 10,
        words: ["PIZZA", "GLOBO", "CAJA", "POSTER", "RELOJ", "RADIO", "CUPCAKE"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_46",
        title: "Steven: Fusiones",
        gridSize: 12,
        words: ["OPALO", "SUGILITE", "SARDONYX", "STEVONNIE", "MALACHITE", "SMOKY"],
        rewardCoins: 200 // Avanzada: 12x12 + STEVONNIE (9) y MALACHITE (9) → 180+20
    },
    {
        id: "lvl_47",
        title: "Bocchi: Musica",
        gridSize: 10,
        words: ["BAJO", "SOLO", "RITMO", "NOTAS", "CANTO", "BANDA", "AUDI"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_48",
        title: "Sonic: Zonas",
        gridSize: 11,
        words: ["GREEN", "HILL", "CASINO", "ICE", "VOLCANO", "JUNGLE", "METRO"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_49",
        title: "Angry Birds: Cerdos",
        gridSize: 10,
        words: ["REY", "CASCO", "CHEF", "BIGOTE", "MINERO", "CABO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_50",
        title: "Filosofia: Existencia",
        gridSize: 12,
        words: ["SER", "NADA", "TIEMPO", "ESPACIO", "MUNDO", "SUJETO", "OBJETO", "AZAR"],
        rewardCoins: 250 // HITO nivel 50 + temática filosófica → máxima recompensa
    },
    {
        id: "lvl_51",
        title: "Aves del Mundo",
        gridSize: 10,
        words: ["AGUILA", "HALCON", "BUHO", "LORO", "CISNE", "CUERVO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_52",
        title: "Geometria",
        gridSize: 11,
        words: ["PUNTO", "RECTA", "PLANO", "ANGULO", "CIRCULO", "ROMBO", "ESFERA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_53",
        title: "Genshin: Inazuma",
        gridSize: 12,
        words: ["AYAKA", "YOIMIYA", "ITTO", "KOKOMI", "SAYU", "SARA", "GOROU", "KAZUHA"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_54",
        title: "ZZZ: Agentes",
        gridSize: 10,
        words: ["KOLEDA", "ANTON", "BEN", "GRACE", "RIINA", "CORIN"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_55",
        title: "NieR: Emociones",
        gridSize: 10,
        words: ["DOLOR", "CULPA", "ESPERA", "IRA", "CALMA", "VACIO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_56",
        title: "Dragon Ball Super",
        gridSize: 12,
        words: ["BEERUS", "WHIS", "HIT", "JIREN", "TOPPO", "CABBA", "KALE", "CAULIFLA"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras (CAULIFLA=8, no supera 8)
    },
    {
        id: "lvl_57",
        title: "FNAF: Pizzaplex",
        gridSize: 11,
        words: ["ROXY", "MONTY", "CHICA", "FREDDY", "VANNY", "GREGORY"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_58",
        title: "Steven: Planeta Madre",
        gridSize: 11,
        words: ["BLANCO", "AZUL", "AMARILLO", "ROSA", "DIAMANTE", "CORTE"],
        rewardCoins: 130 // Media: 11x11, 6 palabras (AMARILLO=8, DIAMANTE=8, no superan 8)
    },
    {
        id: "lvl_59",
        title: "Bocchi: Instrumentos",
        gridSize: 10,
        words: ["PEDAL", "CABLE", "AMPLI", "MICRO", "CUERDA", "BAQUETA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_60",
        title: "Sonic: Aliados",
        gridSize: 10,
        words: ["ROUGE", "CREAM", "BIG", "VECTOR", "ESPIO", "CHARMY"],
        rewardCoins: 250 // HITO nivel 60 → máxima recompensa
    },
    {
        id: "lvl_61",
        title: "Angry Birds: Poderes",
        gridSize: 10,
        words: ["VELOZ", "BOMBA", "DIVIDIR", "PESO", "EMPUJE", "VUELO"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_62",
        title: "Fisica Particulas",
        gridSize: 12,
        words: ["ATOMO", "PROTON", "NEUTRON", "ELECTRON", "QUARK", "FOTON", "BOSON"],
        rewardCoins: 220 // Avanzada: 12x12 + temática científica → rango técnico
    },
    {
        id: "lvl_63",
        title: "Quimica Organica",
        gridSize: 11,
        words: ["CARBONO", "GAS", "ENLACE", "ALCOHOL", "ESTER", "AMINA", "ACIDO"],
        rewardCoins: 200 // Media: 11x11 + temática científica → rango técnico
    },
    {
        id: "lvl_64",
        title: "Biologia Celular",
        gridSize: 12,
        words: ["ADN", "NUCLEO", "MEMBRANA", "CELULA", "TEJIDO", "ORGANO", "VIDA"],
        rewardCoins: 220 // Avanzada: 12x12 + temática científica → rango técnico
    },
    {
        id: "lvl_65",
        title: "Artistas Renacimiento",
        gridSize: 12,
        words: ["LEONARDO", "RAFAEL", "DONATELLO", "MIGUEL", "ANGEL", "TIZIANO"],
        rewardCoins: 200 // Avanzada: 12x12 + DONATELLO (9 chars) → 180+20
    },
    {
        id: "lvl_66",
        title: "Arqueologia",
        gridSize: 10,
        words: ["FOSIL", "TUMBA", "VASO", "HUESO", "RUINA", "MAPA", "PALEO"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_67",
        title: "Mitologia Egipcia",
        gridSize: 11,
        words: ["ANUBIS", "OSIRIS", "HORUS", "ISIS", "RA", "THOT", "SET", "BASTET"],
        rewardCoins: 175 // Media: 11x11, 8 palabras → tope de rango medio
    },
    {
        id: "lvl_68",
        title: "Generos Cine",
        gridSize: 11,
        words: ["TERROR", "ACCION", "DRAMA", "COMEDIA", "SCIFI", "OESTE", "MUSICAL"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_69",
        title: "Programacion: Web",
        gridSize: 12,
        words: ["HTML", "CSS", "REACT", "DOM", "ESTILO", "MARCO", "ENLACE", "WEB", "RED", "NODO", "API", "JSON"],
        rewardCoins: 250 // Maestra: 12x12, 12 palabras + temática técnica → máxima recompensa
    },
    {
        id: "lvl_70",
        title: "Gaming Retro",
        gridSize: 10,
        words: ["PACMAN", "TETRIS", "PONG", "ZELDA", "METROID", "DOOM", "QUAKE"],
        rewardCoins: 250 // HITO nivel 70 → máxima recompensa
    },

    // ─── BLOQUE 71-100: Videojuegos, Cine, Arte y más ───────────────────────

    {
        id: "lvl_71",
        title: "The Legend of Zelda",
        gridSize: 11,
        words: ["LINK", "ZELDA", "GANON", "TRIFORCE", "HYRULE", "EPONA", "NAVI"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_72",
        title: "Marvel: Vengadores",
        gridSize: 10,
        words: ["THOR", "HULK", "VIUDA", "LOKI", "IRON", "ROGERS"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_73",
        title: "Impresionismo",
        gridSize: 10,
        words: ["MONET", "RENOIR", "DEGAS", "LUZ", "JARDIN", "AGUA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_74",
        title: "The Witcher",
        gridSize: 12,
        words: ["GERALT", "YENNEFER", "CIRI", "TRISS", "JASKIER", "ROACH", "LESHEN", "DROWNER"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + YENNEFER (9 chars) → 180+20
    },
    {
        id: "lvl_75",
        title: "Pixar: Personajes",
        gridSize: 11,
        words: ["WOODY", "BUZZ", "NEMO", "DORY", "REMY", "CARL", "MERIDA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_76",
        title: "Escultura",
        gridSize: 10,
        words: ["MARMOL", "ARCILLA", "CINCEL", "BRONCE", "MOLDE"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_77",
        title: "Minecraft",
        gridSize: 11,
        words: ["MADERA", "PIEDRA", "HIERRO", "TIERRA", "ARENA", "DIAMANTE", "CARBON", "CREEPER"],
        rewardCoins: 175 // Media: 11x11, 8 palabras → tope de rango medio
    },
    {
        id: "lvl_78",
        title: "Astronomia",
        gridSize: 12,
        words: ["NEBULOSA", "GALAXIA", "PULSAR", "COMETA", "ORBITA", "QUASAR", "ECLIPSE", "METEORO"],
        rewardCoins: 220 // Avanzada: 12x12, 8 palabras + temática científica → rango técnico
    },
    {
        id: "lvl_79",
        title: "El Señor de los Anillos",
        gridSize: 12,
        words: ["FRODO", "GANDALF", "SAURON", "LEGOLAS", "ARAGORN", "GIMLI", "GOLLUM", "BOROMIR"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_80",
        title: "Gaming: Iconos",
        gridSize: 12,
        words: ["MARIO", "PIKACHU", "KRATOS", "MASTER", "DANTE", "SORA", "CLOUD", "LARA", "GORDON", "KIRBY"],
        rewardCoins: 250 // HITO nivel 80 + Maestra: 12x12, 10 palabras → máxima recompensa
    },
    {
        id: "lvl_81",
        title: "Mortal Kombat",
        gridSize: 12,
        words: ["RAIDEN", "SCORPION", "KANO", "SONYA", "SUBZERO", "KITANA", "KOTAL", "MILEENA"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_82",
        title: "Arquitectura Mundial",
        gridSize: 10,
        words: ["PIRAMIDE", "COLISEO", "LOUVRE", "BABEL", "TEMPLO"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_83",
        title: "Blade Runner",
        gridSize: 11,
        words: ["ROY", "PRIS", "DECKARD", "NEXUS", "REPLICANTE", "TYRRELL"],
        rewardCoins: 150 // Media: 11x11, 6 palabras + REPLICANTE (10 chars) → 130+20
    },
    {
        id: "lvl_84",
        title: "League of Legends",
        gridSize: 12,
        words: ["JINX", "AHRI", "TEEMO", "THRESH", "EZREAL", "VAYNE", "SYNDRA", "LULU"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_85",
        title: "Arte Abstracto",
        gridSize: 10,
        words: ["FORMA", "PLANO", "ANGULO", "CUBO", "LINEA", "COLOR"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_86",
        title: "Studio Ghibli",
        gridSize: 11,
        words: ["TOTORO", "CHIHIRO", "KIKI", "PONYO", "HOWL", "ASHITAKA", "NAUSICAA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_87",
        title: "Final Fantasy",
        gridSize: 12,
        words: ["CLOUD", "TIFA", "AERITH", "SEPHIROTH", "TERRA", "LIGHTNING", "NOCTIS", "TIDUS", "YUNA"],
        rewardCoins: 220 // Avanzada: 12x12, 9 palabras + SEPHIROTH (9) y LIGHTNING (9) → 200+20
    },
    {
        id: "lvl_88",
        title: "Fotografia",
        gridSize: 10,
        words: ["CAMARA", "LENTE", "FLASH", "ENFOQUE", "RETRATO"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_89",
        title: "La Matrix",
        gridSize: 11,
        words: ["NEO", "TRINITY", "MORPHEUS", "SMITH", "ORACLE", "ZION", "CYPHER"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_90",
        title: "Arte Universal",
        gridSize: 12,
        words: ["PINTURA", "ESCULTURA", "MUSICA", "DANZA", "TEATRO", "CINE", "FOTOGRAFIA", "DIBUJO", "OPERA", "MURAL"],
        rewardCoins: 250 // HITO nivel 90 + Maestra: 12x12, 10 palabras + FOTOGRAFIA (10 chars) → máxima recompensa
    },
    {
        id: "lvl_91",
        title: "God of War",
        gridSize: 12,
        words: ["KRATOS", "ATREUS", "ZEUS", "ARES", "POSEIDON", "FREYA", "THOR", "BALDUR"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_92",
        title: "Géneros Musicales",
        gridSize: 10,
        words: ["JAZZ", "BLUES", "ROCK", "POP", "SALSA", "CUMBIA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_93",
        title: "Jurassic Park",
        gridSize: 11,
        words: ["TREX", "RAPTOR", "AMBER", "ISLA", "PARQUE", "MOSA", "CLON"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_94",
        title: "Overwatch: Héroes",
        gridSize: 12,
        words: ["TRACER", "GENJI", "MERCY", "REAPER", "PHARAH", "WINSTON", "DVA", "LUCIO"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_95",
        title: "Surrealismo",
        gridSize: 11,
        words: ["DALI", "MAGRITTE", "ERNST", "SUENO", "IMAGEN", "TIEMPO", "RELOJES"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_96",
        title: "Cine de Tarantino",
        gridSize: 12,
        words: ["PULP", "FICTION", "DJANGO", "BEATRIX", "VEGA", "JULES", "MIA", "VINCENT"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_97",
        title: "Cyberpunk 2077",
        gridSize: 12,
        words: ["JOHNNY", "SILVERHAND", "NETRUNNER", "NIGHT", "CITY", "ARASAKA", "TRAUMA", "MILITECH", "RIPPERDOC"],
        rewardCoins: 220 // Avanzada: 12x12, 9 palabras + SILVERHAND (10) y NETRUNNER (9) → 200+20
    },
    {
        id: "lvl_98",
        title: "Jazz y Blues",
        gridSize: 10,
        words: ["JAZZ", "BLUES", "SWING", "SAXO", "ALMA"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_99",
        title: "Indiana Jones",
        gridSize: 11,
        words: ["JONES", "INDY", "MARIAN", "SALLAH", "BELLOQ", "TEMPLO", "LATIGO"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_100",
        title: "El Gran Final",
        gridSize: 12,
        words: ["EPICO", "MAXIMO", "LOGRO", "CAMPEON", "VICTORIA", "FINAL", "NIVEL", "RECORD", "MAESTRO", "TROFEO", "CROWN", "LEGEND"],
        rewardCoins: 250 // HITO nivel 100 + Maestra: 12x12, 12 palabras → máxima recompensa
    },

    // ─── BLOQUE 101-150: Anime, Series, Cultura, Ciencia y Naturaleza ────────────

    {
        id: "lvl_101",
        title: "One Piece",
        gridSize: 12,
        words: ["LUFFY", "ZORO", "NAMI", "SANJI", "USOPP", "BROOK", "CHOPPER", "ROBIN"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_102",
        title: "Naruto",
        gridSize: 11,
        words: ["NARUTO", "SASUKE", "SAKURA", "KAKASHI", "JIRAIYA", "ITACHI", "GAARA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_103",
        title: "Attack on Titan",
        gridSize: 12,
        words: ["EREN", "MIKASA", "ARMIN", "LEVI", "TITAN", "REINER", "BERTOLT", "HISTORIA"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_104",
        title: "My Hero Academia",
        gridSize: 11,
        words: ["DEKU", "BAKUGO", "OCHAKO", "TODOROKI", "TOKOYAMI", "MINETA", "TSUYU"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_105",
        title: "Death Note",
        gridSize: 10,
        words: ["LIGHT", "RYUK", "KIRA", "MISA", "NEAR", "SHINIGAMI"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras + SHINIGAMI (9 chars) → 125+20
    },
    {
        id: "lvl_106",
        title: "Pokémon Kanto",
        gridSize: 12,
        words: ["PIKACHU", "CHARIZARD", "MEWTWO", "BLASTOISE", "GENGAR", "SNORLAX", "EEVEE", "ARCANINE"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + CHARIZARD (9) y BLASTOISE (9) → 180+20
    },
    {
        id: "lvl_107",
        title: "The Last of Us",
        gridSize: 11,
        words: ["JOEL", "ELLIE", "TESS", "TOMMY", "MARLENE", "CLICKER", "HUNTER"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_108",
        title: "Dark Souls",
        gridSize: 12,
        words: ["SOLAIRE", "GWYN", "ARTORIAS", "SEATH", "ORNSTEIN", "FRAMPT", "GWYNDOLIN", "CROSSBREED"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + CROSSBREED (10 chars) → 180+20
    },
    {
        id: "lvl_109",
        title: "Stardew Valley",
        gridSize: 10,
        words: ["PIERRE", "LEAH", "PENNY", "EMILY", "ROBIN", "MARNIE"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_110",
        title: "Avatar: The Last Airbender",
        gridSize: 12,
        words: ["AANG", "KATARA", "ZUKO", "TOPH", "SOKKA", "IROH", "AZULA", "OZAI", "SUKI", "APPA"],
        rewardCoins: 250 // HITO nivel 110 → máxima recompensa
    },
    {
        id: "lvl_111",
        title: "Breaking Bad",
        gridSize: 11,
        words: ["WALTER", "JESSE", "HEISENBERG", "HANK", "SAUL", "SKYLER", "GALE"],
        rewardCoins: 170 // Media: 11x11, 7 palabras + HEISENBERG (10 chars) → 150+20
    },
    {
        id: "lvl_112",
        title: "Game of Thrones",
        gridSize: 12,
        words: ["DAENERYS", "CERSEI", "TYRION", "JAIME", "SANSA", "ARYA", "JON", "BRAN"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_113",
        title: "Stranger Things",
        gridSize: 10,
        words: ["ELEVEN", "HOPPER", "MIKE", "DUSTIN", "MAX", "DEMOGORGON"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras + DEMOGORGON (10 chars) → 125+20
    },
    {
        id: "lvl_114",
        title: "Los Simpsons",
        gridSize: 11,
        words: ["HOMER", "MARGE", "BART", "LISA", "MAGGIE", "BURNS"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_115",
        title: "Cocina Italiana",
        gridSize: 10,
        words: ["PASTA", "PIZZA", "RISOTTO", "GELATO", "BRUSCHETTA"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_116",
        title: "Cocina Japonesa",
        gridSize: 11,
        words: ["SUSHI", "RAMEN", "UDON", "TEMPURA", "MISO", "SASHIMI"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_117",
        title: "Instrumentos Musicales",
        gridSize: 12,
        words: ["VIOLIN", "FLAUTA", "TROMPETA", "CLARINETE", "CELLO", "OBOE", "TIMBAL", "ARPA"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + CLARINETE (9 chars) → 180+20
    },
    {
        id: "lvl_118",
        title: "Deportes de Agua",
        gridSize: 11,
        words: ["NATACION", "POLO", "CANOA", "KAYAK", "REMO", "BUCEO", "SURF"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_119",
        title: "García Márquez",
        gridSize: 12,
        words: ["MACONDO", "SOLEDAD", "AURELIANO", "REALISMO", "MAGIA", "BUENDIA", "REMEDIOS", "URSULA"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + AURELIANO (9 chars) → 180+20
    },
    {
        id: "lvl_120",
        title: "Matemáticas",
        gridSize: 12,
        words: ["ALGEBRA", "CALCULO", "GEOMETRIA", "FRACCION", "INTEGRAL", "VECTOR", "MATRIZ", "LIMITE", "FUNCION", "DERIVADA"],
        rewardCoins: 250 // HITO nivel 120 + temática técnica + GEOMETRIA (9 chars) → máxima recompensa
    },
    {
        id: "lvl_121",
        title: "Inteligencia Artificial",
        gridSize: 12,
        words: ["NEURONA", "ALGORITMO", "MODELO", "TENSOR", "GRADIENTE", "INFERENCIA", "CAPAS", "PESOS", "DATOS", "ENTRENA"],
        rewardCoins: 250 // Maestra: 12x12, 10 palabras + técnica + ALGORITMO (9) e INFERENCIA (10) → máxima recompensa
    },
    {
        id: "lvl_122",
        title: "Redes y Networking",
        gridSize: 12,
        words: ["ROUTER", "SWITCH", "PROTOCOLO", "LATENCIA", "PAQUETE", "FIREWALL", "SERVIDOR", "CLIENTE"],
        rewardCoins: 220 // Avanzada: 12x12, 8 palabras + temática técnica + PROTOCOLO (9 chars) → rango técnico
    },
    {
        id: "lvl_123",
        title: "Ecosistemas Terrestres",
        gridSize: 10,
        words: ["TAIGA", "TUNDRA", "SELVA", "SABANA", "PANTANO"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_124",
        title: "Mitología Japonesa",
        gridSize: 11,
        words: ["AMATERASU", "SUSANOO", "IZANAGI", "KITSUNE", "ONI", "TANUKI", "RYUJIN"],
        rewardCoins: 170 // Media: 11x11, 7 palabras + AMATERASU (9 chars) → 150+20
    },
    {
        id: "lvl_125",
        title: "Mitología Azteca",
        gridSize: 12,
        words: ["QUETZAL", "TLALOC", "XOCHITL", "COATL", "AZTECA", "TEPEU", "ITZAMNA"],
        rewardCoins: 200 // Avanzada: 12x12, 7 palabras + temática filosófica/mitológica → rango técnico
    },
    {
        id: "lvl_126",
        title: "América Latina",
        gridSize: 10,
        words: ["MEXICO", "BRASIL", "CHILE", "PERU", "CUBA", "COLOMBIA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_127",
        title: "Capitales Europeas",
        gridSize: 11,
        words: ["PARIS", "ROMA", "BERLIN", "MADRID", "VIENA", "ATENAS", "LISBOA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_128",
        title: "Océanos y Mares",
        gridSize: 10,
        words: ["PACIFICO", "ATLANTICO", "ARTICO", "INDICO", "CASPIO"],
        rewardCoins: 120 // Básica: 10x10, 5 palabras + ATLANTICO (9 chars) → 100+20
    },
    {
        id: "lvl_129",
        title: "Artes Marciales",
        gridSize: 11,
        words: ["KARATE", "JUDO", "TAEKWONDO", "KENDO", "AIKIDO", "KUNGFU", "CAPOEIRA"],
        rewardCoins: 170 // Media: 11x11, 7 palabras + TAEKWONDO (9 chars) → 150+20
    },
    {
        id: "lvl_130",
        title: "Hades: Olimpo",
        gridSize: 12,
        words: ["ZAGREUS", "NYX", "HYPNOS", "THANATOS", "CERBERUS", "ARES", "ARTEMIS", "CHAOS", "DIONISO", "POSEIDON"],
        rewardCoins: 250 // HITO nivel 130 → máxima recompensa
    },
    {
        id: "lvl_131",
        title: "Hollow Knight",
        gridSize: 12,
        words: ["HORNET", "QUIRREL", "GRIMM", "ZOTE", "CORNIFER", "GHOST", "DEEPNEST", "HALLOWNEST"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + HALLOWNEST (10 chars) → 180+20
    },
    {
        id: "lvl_132",
        title: "Fortnite: Armas",
        gridSize: 10,
        words: ["ESCOPETA", "RIFLE", "PISTOLA", "GRANADA", "LANZADOR", "TRAMPA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_133",
        title: "Among Us",
        gridSize: 10,
        words: ["IMPOSTOR", "TAREA", "SABOTAJE", "VENT", "EXPULSAR", "MAPA"],
        rewardCoins: 125 // Básica: 10x10, 6 palabras (tope de rango)
    },
    {
        id: "lvl_134",
        title: "Doctor Who",
        gridSize: 11,
        words: ["TARDIS", "DALEK", "TIMELORD", "CYBERMAN", "SONIC", "MASTER", "COMPANIONS"],
        rewardCoins: 170 // Media: 11x11, 7 palabras + COMPANIONS (10 chars) → 150+20
    },
    {
        id: "lvl_135",
        title: "Sherlock Holmes",
        gridSize: 10,
        words: ["WATSON", "MORIARTY", "BAKER", "IRENE", "LESTRADE"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_136",
        title: "Bebidas del Mundo",
        gridSize: 11,
        words: ["SAKE", "WHISKY", "VODKA", "TEQUILA", "COGNAC", "CERVEZA"],
        rewardCoins: 130 // Media: 11x11, 6 palabras
    },
    {
        id: "lvl_137",
        title: "Red Dead Redemption",
        gridSize: 12,
        words: ["ARTHUR", "DUTCH", "JOHN", "ABIGAIL", "HOSEA", "JAVIER", "MARSTON", "MICAH"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },
    {
        id: "lvl_138",
        title: "The Office",
        gridSize: 10,
        words: ["MICHAEL", "DWIGHT", "JIM", "PAM", "ANDY", "KEVIN", "RYAN"],
        rewardCoins: 130 // 10x10, 7 palabras → sobre rango básico
    },
    {
        id: "lvl_139",
        title: "Ballet y Danza",
        gridSize: 10,
        words: ["POINTE", "PLIE", "ARABESQUE", "JETE", "FOUETTE", "PIROUETTE"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras + ARABESQUE (9) y PIROUETTE (9) → 125+20
    },
    {
        id: "lvl_140",
        title: "Medicina y Ciencia",
        gridSize: 12,
        words: ["CELULA", "TEJIDO", "ANATOMIA", "FARMACO", "CIRUGIA", "VACUNA", "DIAGNOSTICO", "NERVIO", "MUSCULO", "ORGANO"],
        rewardCoins: 250 // HITO nivel 140 + temática técnica + DIAGNOSTICO (11 chars) → máxima recompensa
    },
    {
        id: "lvl_141",
        title: "Shakespeare",
        gridSize: 12,
        words: ["HAMLET", "OTHELLO", "MACBETH", "ROMEO", "JULIETA", "FALSTAFF", "PROSPERO", "CALIBAN"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + temática literaria clásica
    },
    {
        id: "lvl_142",
        title: "Black Mirror",
        gridSize: 11,
        words: ["NOSEDIVE", "COOKIE", "ARKANGEL", "METALHEAD", "CROCODILE", "BANDERSNATCH"],
        rewardCoins: 150 // Media: 11x11, 6 palabras + BANDERSNATCH (12 chars) → 130+20
    },
    {
        id: "lvl_143",
        title: "Reptiles del Mundo",
        gridSize: 10,
        words: ["IGUANA", "COBRA", "GECKO", "CAIMAN", "MAMBA"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_144",
        title: "Mitología Celta",
        gridSize: 11,
        words: ["DAGDA", "LUGH", "CERNUNNOS", "BRIGID", "MORRIGAN", "NUADA", "TUATHA"],
        rewardCoins: 170 // Media: 11x11, 7 palabras + CERNUNNOS (9 chars) → 150+20
    },
    {
        id: "lvl_145",
        title: "Pokémon Johto",
        gridSize: 12,
        words: ["TOTODILE", "CHIKORITA", "CYNDAQUIL", "LUGIA", "ESPEON", "UMBREON", "AMPHAROS", "SCIZOR"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras + CHIKORITA (9) y CYNDAQUIL (9) → 180+20
    },
    {
        id: "lvl_146",
        title: "Montañas del Mundo",
        gridSize: 10,
        words: ["EVEREST", "HIMALAYA", "ANDINO", "ROCOSAS", "ALPES"],
        rewardCoins: 100 // Básica: 10x10, 5 palabras
    },
    {
        id: "lvl_147",
        title: "Insectos",
        gridSize: 10,
        words: ["HORMIGA", "ABEJA", "ESCARABAJO", "MARIPOSA", "CIGARRA", "MOSQUITO"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras + ESCARABAJO (10 chars) → 125+20
    },
    {
        id: "lvl_148",
        title: "Atletismo Olímpico",
        gridSize: 11,
        words: ["SPRINT", "MARATON", "SALTO", "JABALINA", "DISCO", "MARTILLO", "VALLAS"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_149",
        title: "Celeste",
        gridSize: 10,
        words: ["MADELEINE", "BADELINE", "RESORT", "SUMMIT", "CUERVO", "EVEREST"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras + MADELEINE (9 chars) → 125+20
    },
    {
        id: "lvl_150",
        title: "Tecnología del Futuro",
        gridSize: 12,
        words: ["BLOCKCHAIN", "METAVERSO", "CUANTICO", "NANOBOT", "ROBOTICA", "HOLOGRAMA", "FUSION", "SATELITE", "BITCOIN", "QUANTUM"],
        rewardCoins: 250 // HITO nivel 150 + Maestra: 12x12, 10 palabras + técnica + BLOCKCHAIN (10) → máxima recompensa
    }
];

// Validación de niveles al cargar
(function validateLevels() {
    const seenIds = new Set();
    
    window.LA_WS_LEVELS.forEach((level, index) => {
        // Validar ID único
        if (seenIds.has(level.id)) {
            console.error(`[WordSearch] Error: ID duplicado "${level.id}" en nivel ${index + 1}`);
        }
        seenIds.add(level.id);

        // Validar gridSize mínimo
        if (level.gridSize < 10) {
            console.error(`[WordSearch] Error: gridSize debe ser >= 10 en nivel "${level.id}"`);
        }

        // Validar rewardCoins
        if (!Number.isInteger(level.rewardCoins) || level.rewardCoins <= 0) {
            console.error(`[WordSearch] Error: rewardCoins debe ser entero positivo en nivel "${level.id}"`);
        }

        // Validar palabras
        if (!Array.isArray(level.words) || level.words.length === 0) {
            console.error(`[WordSearch] Error: words debe ser array no vacío en nivel "${level.id}"`);
        }
    });

    console.log(`[WordSearch] ✓ ${window.LA_WS_LEVELS.length} niveles cargados correctamente`);
})();

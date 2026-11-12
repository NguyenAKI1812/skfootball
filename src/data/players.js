import playerPhotos from './player_photos.json';

const RAW_TIER_1 = [
  // --- THỦ MÔN (GK) ---
  {
    id: "t1_gk_1",
    name: "Lev Yashin",
    tier: 1,
    position: "GK",
    subPos: "GK",
    ovr: 94,
    nation: "Nga",
    nationCode: "ru",
    club: "Dynamo Moscow",
    stats: { div: 95, han: 91, kic: 85, ref: 96, spe: 64, pos: 95 },
    era: "Legend",
    badge: "Icon",
    image: "🧤"
  },
  {
    id: "t1_gk_2",
    name: "Gianluigi Buffon",
    tier: 1,
    position: "GK",
    subPos: "GK",
    ovr: 93,
    nation: "Ý",
    nationCode: "it",
    club: "Juventus",
    stats: { div: 92, han: 93, kic: 80, ref: 94, spe: 55, pos: 94 },
    era: "Legend",
    badge: "Icon",
    image: "🧤"
  },
  {
    id: "t1_gk_3",
    name: "Manuel Neuer",
    tier: 1,
    position: "GK",
    subPos: "GK",
    ovr: 92,
    nation: "Đức",
    nationCode: "de",
    club: "Bayern Munich",
    stats: { div: 91, han: 89, kic: 95, ref: 91, spe: 68, pos: 91 },
    era: "Modern",
    badge: "Star",
    image: "🧤"
  },
  {
    id: "t1_gk_4",
    name: "Iker Casillas",
    tier: 1,
    position: "GK",
    subPos: "GK",
    ovr: 92,
    nation: "Tây Ban Nha",
    nationCode: "es",
    club: "Real Madrid",
    stats: { div: 94, han: 88, kic: 82, ref: 95, spe: 62, pos: 91 },
    era: "Legend",
    badge: "Icon",
    image: "🧤"
  },

  // --- HẬU VỆ (DF: LB, LCB, RCB, RB) ---
  {
    id: "t1_rb_1",
    name: "Cafu",
    tier: 1,
    position: "DF",
    subPos: "RB",
    ovr: 93,
    nation: "Brazil",
    nationCode: "br",
    club: "AC Milan",
    stats: { pac: 92, sho: 75, pas: 85, dri: 89, def: 90, phy: 91 },
    era: "Legend",
    badge: "Icon",
    image: "🛡️"
  },
  {
    id: "t1_rb_2",
    name: "Dani Alves",
    tier: 1,
    position: "DF",
    subPos: "RB",
    ovr: 91,
    nation: "Brazil",
    nationCode: "br",
    club: "Barcelona",
    stats: { pac: 89, sho: 78, pas: 88, dri: 90, def: 85, phy: 84 },
    era: "Legend",
    badge: "Star",
    image: "🛡️"
  },
  {
    id: "t1_rb_3",
    name: "Javier Zanetti",
    tier: 1,
    position: "DF",
    subPos: "RB",
    ovr: 92,
    nation: "Argentina",
    nationCode: "ar",
    club: "Inter Milan",
    stats: { pac: 86, sho: 68, pas: 84, dri: 84, def: 92, phy: 89 },
    era: "Legend",
    badge: "Icon",
    image: "🛡️"
  },
  {
    id: "t1_cb_1",
    name: "Paolo Maldini",
    tier: 1,
    position: "DF",
    subPos: "LCB",
    ovr: 94,
    nation: "Ý",
    nationCode: "it",
    club: "AC Milan",
    stats: { pac: 86, sho: 56, pas: 75, dri: 72, def: 96, phy: 87 },
    era: "Legend",
    badge: "Icon",
    image: "🛡️"
  },
  {
    id: "t1_cb_2",
    name: "Franz Beckenbauer",
    tier: 1,
    position: "DF",
    subPos: "RCB",
    ovr: 94,
    nation: "Đức",
    nationCode: "de",
    club: "Bayern Munich",
    stats: { pac: 83, sho: 74, pas: 88, dri: 86, def: 95, phy: 85 },
    era: "Legend",
    badge: "Icon",
    image: "🛡️"
  },
  {
    id: "t1_cb_3",
    name: "Sergio Ramos",
    tier: 1,
    position: "DF",
    subPos: "RCB",
    ovr: 91,
    nation: "Tây Ban Nha",
    nationCode: "es",
    club: "Real Madrid",
    stats: { pac: 80, sho: 72, pas: 78, dri: 74, def: 92, phy: 91 },
    era: "Modern",
    badge: "Star",
    image: "🛡️"
  },
  {
    id: "t1_cb_4",
    name: "Virgil van Dijk",
    tier: 1,
    position: "DF",
    subPos: "LCB",
    ovr: 90,
    nation: "Hà Lan",
    nationCode: "nl",
    club: "Liverpool",
    stats: { pac: 81, sho: 60, pas: 72, dri: 72, def: 92, phy: 89 },
    era: "Modern",
    badge: "Star",
    image: "🛡️"
  },
  {
    id: "t1_lb_1",
    name: "Roberto Carlos",
    tier: 1,
    position: "DF",
    subPos: "LB",
    ovr: 92,
    nation: "Brazil",
    nationCode: "br",
    club: "Real Madrid",
    stats: { pac: 94, sho: 88, pas: 84, dri: 85, def: 84, phy: 89 },
    era: "Legend",
    badge: "Icon",
    image: "🛡️"
  },
  {
    id: "t1_lb_2",
    name: "Ashley Cole",
    tier: 1,
    position: "DF",
    subPos: "LB",
    ovr: 89,
    nation: "Anh",
    nationCode: "en",
    club: "Chelsea",
    stats: { pac: 90, sho: 65, pas: 80, dri: 83, def: 89, phy: 82 },
    era: "Legend",
    badge: "Star",
    image: "🛡️"
  },
  {
    id: "t1_lb_3",
    name: "Marcelo",
    tier: 1,
    position: "DF",
    subPos: "LB",
    ovr: 90,
    nation: "Brazil",
    nationCode: "br",
    club: "Real Madrid",
    stats: { pac: 86, sho: 76, pas: 87, dri: 91, def: 82, phy: 81 },
    era: "Modern",
    badge: "Star",
    image: "🛡️"
  },

  // --- TIỀN VỆ (MF: CM, CAM, CDM) ---
  {
    id: "t1_mf_1",
    name: "Zinedine Zidane",
    tier: 1,
    position: "MF",
    subPos: "CAM",
    ovr: 96,
    nation: "Pháp",
    nationCode: "fr",
    club: "Real Madrid",
    stats: { pac: 85, sho: 90, pas: 96, dri: 95, def: 75, phy: 86 },
    era: "Legend",
    badge: "Icon",
    image: "⚡"
  },
  {
    id: "t1_mf_2",
    name: "Xavi Hernandez",
    tier: 1,
    position: "MF",
    subPos: "CM",
    ovr: 93,
    nation: "Tây Ban Nha",
    nationCode: "es",
    club: "Barcelona",
    stats: { pac: 76, sho: 76, pas: 96, dri: 92, def: 76, phy: 73 },
    era: "Legend",
    badge: "Icon",
    image: "⚡"
  },
  {
    id: "t1_mf_3",
    name: "Andres Iniesta",
    tier: 1,
    position: "MF",
    subPos: "CM",
    ovr: 93,
    nation: "Tây Ban Nha",
    nationCode: "es",
    club: "Barcelona",
    stats: { pac: 82, sho: 80, pas: 95, dri: 94, def: 68, phy: 66 },
    era: "Legend",
    badge: "Icon",
    image: "⚡"
  },
  {
    id: "t1_mf_4",
    name: "Kevin De Bruyne",
    tier: 1,
    position: "MF",
    subPos: "CAM",
    ovr: 92,
    nation: "Bỉ",
    nationCode: "be",
    club: "Manchester City",
    stats: { pac: 74, sho: 88, pas: 94, dri: 87, def: 65, phy: 78 },
    era: "Modern",
    badge: "Star",
    image: "⚡"
  },
  {
    id: "t1_mf_5",
    name: "Luka Modric",
    tier: 1,
    position: "MF",
    subPos: "CM",
    ovr: 91,
    nation: "Croatia",
    nationCode: "hr",
    club: "Real Madrid",
    stats: { pac: 74, sho: 79, pas: 91, dri: 90, def: 74, phy: 70 },
    era: "Modern",
    badge: "Star",
    image: "⚡"
  },
  {
    id: "t1_mf_6",
    name: "Patrick Vieira",
    tier: 1,
    position: "MF",
    subPos: "CDM",
    ovr: 92,
    nation: "Pháp",
    nationCode: "fr",
    club: "Arsenal",
    stats: { pac: 83, sho: 78, pas: 84, dri: 84, def: 91, phy: 93 },
    era: "Legend",
    badge: "Icon",
    image: "⚡"
  },

  // --- TIỀN ĐẠO (FW: LW, ST, RW) ---
  {
    id: "t1_fw_1",
    name: "Lionel Messi",
    tier: 1,
    position: "FW",
    subPos: "RW",
    ovr: 97,
    nation: "Argentina",
    nationCode: "ar",
    club: "Barcelona",
    stats: { pac: 92, sho: 96, pas: 94, dri: 97, def: 40, phy: 72 },
    era: "Modern",
    badge: "GOAT",
    image: "👑"
  },
  {
    id: "t1_fw_2",
    name: "Cristiano Ronaldo",
    tier: 1,
    position: "FW",
    subPos: "LW",
    ovr: 96,
    nation: "Bồ Đào Nha",
    nationCode: "pt",
    club: "Real Madrid",
    stats: { pac: 93, sho: 97, pas: 84, dri: 90, def: 38, phy: 88 },
    era: "Modern",
    badge: "GOAT",
    image: "👑"
  },
  {
    id: "t1_fw_3",
    name: "Ronaldinho",
    tier: 1,
    position: "FW",
    subPos: "LW",
    ovr: 95,
    nation: "Brazil",
    nationCode: "br",
    club: "Barcelona",
    stats: { pac: 92, sho: 89, pas: 91, dri: 96, def: 42, phy: 80 },
    era: "Legend",
    badge: "Icon",
    image: "👑"
  },
  {
    id: "t1_fw_4",
    name: "Kylian Mbappé",
    tier: 1,
    position: "FW",
    subPos: "LW",
    ovr: 93,
    nation: "Pháp",
    nationCode: "fr",
    club: "Real Madrid",
    stats: { pac: 97, sho: 90, pas: 82, dri: 92, def: 36, phy: 78 },
    era: "Modern",
    badge: "Star",
    image: "⚡"
  },
  {
    id: "t1_st_1",
    name: "Pelé",
    tier: 1,
    position: "FW",
    subPos: "ST",
    ovr: 98,
    nation: "Brazil",
    nationCode: "br",
    club: "Santos",
    stats: { pac: 95, sho: 97, pas: 93, dri: 96, def: 55, phy: 78 },
    era: "Legend",
    badge: "GOAT",
    image: "👑"
  },
  {
    id: "t1_st_2",
    name: "Ronaldo De Lima (R9)",
    tier: 1,
    position: "FW",
    subPos: "ST",
    ovr: 96,
    nation: "Brazil",
    nationCode: "br",
    club: "Inter Milan",
    stats: { pac: 96, sho: 95, pas: 81, dri: 95, def: 45, phy: 84 },
    era: "Legend",
    badge: "Icon",
    image: "👑"
  },
  {
    id: "t1_st_3",
    name: "Thierry Henry",
    tier: 1,
    position: "FW",
    subPos: "ST",
    ovr: 93,
    nation: "Pháp",
    nationCode: "fr",
    club: "Arsenal",
    stats: { pac: 94, sho: 91, pas: 83, dri: 90, def: 53, phy: 80 },
    era: "Legend",
    badge: "Icon",
    image: "⚡"
  },
  {
    id: "t1_st_4",
    name: "Erling Haaland",
    tier: 1,
    position: "FW",
    subPos: "ST",
    ovr: 92,
    nation: "Na Uy",
    nationCode: "no",
    club: "Manchester City",
    stats: { pac: 90, sho: 94, pas: 68, dri: 81, def: 45, phy: 90 },
    era: "Modern",
    badge: "Star",
    image: "⚡"
  }
];

const RAW_TIER_2 = [
  // --- THỦ MÔN TẦNG 2 (GK) ---
  {
    id: "t2_gk_1",
    name: "Jordan Pickford",
    tier: 2,
    position: "GK",
    subPos: "GK",
    ovr: 82,
    nation: "Anh",
    nationCode: "en",
    club: "Everton",
    stats: { div: 83, han: 78, kic: 87, ref: 85, spe: 50, pos: 80 },
    badge: "Mid",
    image: "🧤"
  },
  {
    id: "t2_gk_2",
    name: "André Onana",
    tier: 2,
    position: "GK",
    subPos: "GK",
    ovr: 82,
    nation: "Cameroon",
    nationCode: "cm",
    club: "Manchester United",
    stats: { div: 81, han: 79, kic: 86, ref: 84, spe: 55, pos: 79 },
    badge: "Mid",
    image: "🧤"
  },
  {
    id: "t2_gk_3",
    name: "Aaron Ramsdale",
    tier: 2,
    position: "GK",
    subPos: "GK",
    ovr: 80,
    nation: "Anh",
    nationCode: "en",
    club: "Southampton",
    stats: { div: 82, han: 77, kic: 83, ref: 82, spe: 52, pos: 78 },
    badge: "Mid",
    image: "🧤"
  },
  {
    id: "t2_gk_4",
    name: "Kepa Arrizabalaga",
    tier: 2,
    position: "GK",
    subPos: "GK",
    ovr: 79,
    nation: "Tây Ban Nha",
    nationCode: "es",
    club: "Bournemouth",
    stats: { div: 80, han: 76, kic: 82, ref: 81, spe: 48, pos: 77 },
    badge: "Mid",
    image: "🧤"
  },

  // --- HẬU VỆ TẦNG 2 (DF: LB, LCB, RCB, RB) ---
  {
    id: "t2_df_1",
    name: "Harry Maguire",
    tier: 2,
    position: "DF",
    subPos: "RCB",
    ovr: 80,
    nation: "Anh",
    nationCode: "en",
    club: "Manchester United",
    stats: { pac: 58, sho: 55, pas: 70, dri: 68, def: 82, phy: 86 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_df_2",
    name: "Lewis Dunk",
    tier: 2,
    position: "DF",
    subPos: "LCB",
    ovr: 81,
    nation: "Anh",
    nationCode: "en",
    club: "Brighton",
    stats: { pac: 60, sho: 48, pas: 72, dri: 66, def: 82, phy: 81 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_df_3",
    name: "Marc Cucurella",
    tier: 2,
    position: "DF",
    subPos: "LB",
    ovr: 82,
    nation: "Tây Ban Nha",
    nationCode: "es",
    club: "Chelsea",
    stats: { pac: 80, sho: 62, pas: 76, dri: 78, def: 79, phy: 78 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_df_4",
    name: "Emerson Royal",
    tier: 2,
    position: "DF",
    subPos: "RB",
    ovr: 79,
    nation: "Brazil",
    nationCode: "br",
    club: "AC Milan",
    stats: { pac: 79, sho: 60, pas: 71, dri: 74, def: 78, phy: 79 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_df_5",
    name: "James Tarkowski",
    tier: 2,
    position: "DF",
    subPos: "RCB",
    ovr: 80,
    nation: "Anh",
    nationCode: "en",
    club: "Everton",
    stats: { pac: 56, sho: 45, pas: 64, dri: 62, def: 82, phy: 84 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_df_6",
    name: "Lucas Digne",
    tier: 2,
    position: "DF",
    subPos: "LB",
    ovr: 80,
    nation: "Pháp",
    nationCode: "fr",
    club: "Aston Villa",
    stats: { pac: 76, sho: 68, pas: 80, dri: 76, def: 77, phy: 74 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_df_7",
    name: "Matty Cash",
    tier: 2,
    position: "DF",
    subPos: "RB",
    ovr: 80,
    nation: "Ba Lan",
    nationCode: "pl",
    club: "Aston Villa",
    stats: { pac: 83, sho: 66, pas: 73, dri: 76, def: 77, phy: 78 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_df_8",
    name: "Victor Lindelof",
    tier: 2,
    position: "DF",
    subPos: "LCB",
    ovr: 79,
    nation: "Thụy Điển",
    nationCode: "se",
    club: "Manchester United",
    stats: { pac: 68, sho: 50, pas: 73, dri: 71, def: 80, phy: 76 },
    badge: "Mid",
    image: "🛡️"
  },

  // --- TIỀN VỆ TẦNG 2 (MF: CM, CAM, CDM) ---
  {
    id: "t2_mf_1",
    name: "James Ward-Prowse",
    tier: 2,
    position: "MF",
    subPos: "CM",
    ovr: 82,
    nation: "Anh",
    nationCode: "en",
    club: "Nottingham Forest",
    stats: { pac: 66, sho: 80, pas: 86, dri: 77, def: 74, phy: 75 },
    badge: "Mid",
    image: "🎯"
  },
  {
    id: "t2_mf_2",
    name: "Scott McTominay",
    tier: 2,
    position: "MF",
    subPos: "CDM",
    ovr: 81,
    nation: "Scotland",
    nationCode: "sct",
    club: "Napoli",
    stats: { pac: 72, sho: 78, pas: 76, dri: 75, def: 78, phy: 85 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_mf_3",
    name: "Tomas Soucek",
    tier: 2,
    position: "MF",
    subPos: "CDM",
    ovr: 80,
    nation: "Cộng Hòa Séc",
    nationCode: "cz",
    club: "West Ham",
    stats: { pac: 65, sho: 74, pas: 72, dri: 71, def: 79, phy: 86 },
    badge: "Mid",
    image: "🛡️"
  },
  {
    id: "t2_mf_4",
    name: "Fred",
    tier: 2,
    position: "MF",
    subPos: "CM",
    ovr: 79,
    nation: "Brazil",
    nationCode: "br",
    club: "Fenerbahce",
    stats: { pac: 76, sho: 68, pas: 77, dri: 80, def: 76, phy: 75 },
    badge: "Mid",
    image: "⚡"
  },
  {
    id: "t2_mf_5",
    name: "Conor Gallagher",
    tier: 2,
    position: "MF",
    subPos: "CM",
    ovr: 82,
    nation: "Anh",
    nationCode: "en",
    club: "Atletico Madrid",
    stats: { pac: 77, sho: 76, pas: 78, dri: 79, def: 77, phy: 83 },
    badge: "Mid",
    image: "⚡"
  },
  {
    id: "t2_mf_6",
    name: "Mario Pasalic",
    tier: 2,
    position: "MF",
    subPos: "CAM",
    ovr: 80,
    nation: "Croatia",
    nationCode: "hr",
    club: "Atalanta",
    stats: { pac: 70, sho: 79, pas: 77, dri: 77, def: 70, phy: 78 },
    badge: "Mid",
    image: "⚡"
  }
];

// Enrich with Real Player Photos
export const TIER_1_PLAYERS = RAW_TIER_1.map(p => ({
  ...p,
  photo: playerPhotos[p.id] || null
}));

export const TIER_2_PLAYERS = RAW_TIER_2.map(p => ({
  ...p,
  photo: playerPhotos[p.id] || null
}));

// Cấu trúc vị trí thi đấu: Gồm 11 vị trí xuất phát.
// Đặc biệt: Ở vị trí tiền vệ trung tâm, người chơi có thể chọn CAM (ở trên) hoặc CDM (ở dưới); khi đặt 1 trong 2 thì ô còn lại sẽ biến mất.
export const SQUAD_POSITIONS = [
  // 1. THỦ MÔN (1 vị trí)
  { id: "gk", code: "GK", name: "Thủ Môn", category: "GK", lineName: "Goalkeeper", x: 50, y: 88 },

  // 2. HẬU VỆ (4 vị trí: LB, LCB, RCB, RB)
  { id: "lb", code: "LB", name: "Hậu Vệ Trái", category: "DF", lineName: "Defender", x: 15, y: 72 },
  { id: "lcb", code: "LCB", name: "Trung Vệ Trái", category: "DF", lineName: "Defender", x: 38, y: 74 },
  { id: "rcb", code: "RCB", name: "Trung Vệ Phải", category: "DF", lineName: "Defender", x: 62, y: 74 },
  { id: "rb", code: "RB", name: "Hậu Vệ Phải", category: "DF", lineName: "Defender", x: 85, y: 72 },

  // 3. TIỀN VỆ (CM1, CM2, và lựa chọn giữa CAM hoặc CDM)
  { id: "cm1", code: "CM", name: "Tiền Vệ Trái", category: "MF", lineName: "Midfielder", x: 23, y: 48 },
  { id: "cam", code: "CAM", name: "Tiền Vệ Công", category: "MF", lineName: "Midfielder", x: 50, y: 36, pairId: "cdm" },
  { id: "cdm", code: "CDM", name: "Tiền Vệ Trụ", category: "MF", lineName: "Midfielder", x: 50, y: 58, pairId: "cam" },
  { id: "cm2", code: "CM", name: "Tiền Vệ Phải", category: "MF", lineName: "Midfielder", x: 77, y: 48 },

  // 4. TIỀN ĐẠO (3 vị trí: LW, ST, RW)
  { id: "lw", code: "LW", name: "Tiền Đạo Trái", category: "FW", lineName: "Forward", x: 18, y: 19 },
  { id: "st", code: "ST", name: "Tiền Đạo Cắm", category: "FW", lineName: "Forward", x: 50, y: 14 },
  { id: "rw", code: "RW", name: "Tiền Đạo Phải", category: "FW", lineName: "Forward", x: 82, y: 19 },
];

// Hàm sinh 11 Vòng Đấu: Đúng 1 GK, 4 DF, 3 MF, 3 FW
export function generateDraftSchedule() {
  const categories = [
    'GK',
    'DF', 'DF', 'DF', 'DF',
    'MF', 'MF', 'MF',
    'FW', 'FW', 'FW'
  ];

  for (let i = categories.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }

  const categoryNames = {
    GK: 'GOALKEEPER (GK)',
    DF: 'DEFENDER (DF)',
    MF: 'MIDFIELDER (MF)',
    FW: 'FORWARD (FW)'
  };

  return categories.map((cat, idx) => ({
    roundIndex: idx,
    roundNumber: idx + 1,
    category: cat,
    name: categoryNames[cat]
  }));
}

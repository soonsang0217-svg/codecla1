// District-to-subregion mapping for KMA area codes that get split further
// than 시/군/구 (e.g. 인천 -> 인천남부/북부/영종, 파주 -> 파주서북부/동북부/남부).
// Transcribed from the KMA-provided PDF "기상특보 세분구역 안내" (제공: 사용자),
// which lists exactly which 구/읍/면/동 belongs to each subregion. Every
// "parent" and "sub" name here is verified to exist verbatim in kmaRegions.ts.
//
// Rules are ordered most-specific-first: for a parent whose split happens
// only within one of its own districts (e.g. 청주 -> 상당구 splits between
// 청주동부/서부 while the other 3 구 are entirely 청주서부), list the narrower
// district-level rule before the broader catch-all so it is checked first.
export interface SubRegionRule {
  /** Must match a name that exists in KMA_REGIONS. */
  sub: string;
  /** Kakao region_2depth_name or region_3depth_name values that belong here. */
  districts: string[];
}

export interface SubRegionSplit {
  /** The KMA_REGIONS name this split applies to. */
  parent: string;
  rules: SubRegionRule[];
}

export const KMA_SUBREGION_SPLITS: SubRegionSplit[] = [
  {
    parent: "서울",
    rules: [
      { sub: "서울서북권", districts: ["은평구", "종로구", "마포구", "서대문구", "중구", "용산구"] },
      { sub: "서울서남권", districts: ["강서구", "양천구", "구로구", "영등포구", "동작구", "관악구", "금천구"] },
      { sub: "서울동북권", districts: ["도봉구", "노원구", "강북구", "성북구", "동대문구", "중랑구", "성동구", "광진구"] },
      { sub: "서울동남권", districts: ["강동구", "송파구", "강남구", "서초구"] },
    ],
  },
  {
    parent: "파주",
    rules: [
      { sub: "파주서북부", districts: ["장단면", "군내면", "진서면", "진동면"] },
      { sub: "파주동북부", districts: ["문산읍", "법원읍", "파주읍", "적성면", "파평면"] },
      { sub: "파주남부", districts: ["조리읍", "광탄면", "탄현면", "월롱면"] },
    ],
  },
  {
    parent: "인천",
    rules: [
      { sub: "인천영종", districts: ["영종동", "영종1동", "영종2동", "운서동", "용유동"] },
      { sub: "인천북부", districts: ["서구", "북구", "계양구"] },
      { sub: "인천남부", districts: ["동구", "미추홀구", "연수구", "남동구", "중구"] },
    ],
  },
  {
    parent: "용인",
    rules: [
      { sub: "용인서북부", districts: ["기흥구", "수지구"] },
      { sub: "용인동북부", districts: ["포곡읍", "모현읍", "양지면"] },
      { sub: "용인남부", districts: ["이동읍", "남사읍", "원삼면", "백암면"] },
    ],
  },
  {
    parent: "여주",
    rules: [
      { sub: "여주서부", districts: ["산북면", "금사면", "흥천면", "대신면", "세종대왕면"] },
      { sub: "여주동남부", districts: ["가남읍", "점동면", "북내면", "강천면"] },
    ],
  },
  {
    parent: "양평",
    rules: [
      { sub: "양평서부", districts: ["양평읍", "강상면", "강하면", "옥천면", "양서면", "서종면", "개군면"] },
      { sub: "양평동부", districts: ["단월면", "청운면", "양동면", "지평면", "용문면"] },
    ],
  },
  {
    parent: "고성",
    rules: [
      { sub: "고성산지", districts: ["간성읍", "수동면"] },
      { sub: "고성평지", districts: ["거진읍", "현내면", "죽왕면", "토성면"] },
    ],
  },
  {
    parent: "양구",
    rules: [
      { sub: "양구산지", districts: ["해안면"] },
      { sub: "양구평지", districts: ["방산면", "양구읍", "동면", "국토정중앙면"] },
    ],
  },
  {
    parent: "인제",
    rules: [
      { sub: "인제평지", districts: ["인제읍", "남면"] },
      { sub: "인제산지", districts: ["서화면", "북면", "기린면", "상남면"] },
    ],
  },
  {
    parent: "속초",
    rules: [
      { sub: "속초산지", districts: ["노학동", "설악동"] },
      { sub: "속초평지", districts: [] },
    ],
  },
  {
    parent: "양양",
    rules: [
      { sub: "양양평지", districts: ["양양읍", "손양면", "현남면"] },
      { sub: "양양산지", districts: ["강현면", "서면", "현북면"] },
    ],
  },
  {
    parent: "강릉",
    rules: [
      { sub: "강릉평지", districts: ["주문진읍", "구정면", "강동면", "옥계면", "사천면"] },
      { sub: "강릉산지", districts: ["연곡면", "성산면", "왕산면"] },
    ],
  },
  {
    parent: "평창",
    rules: [
      { sub: "평창산지", districts: ["진부면", "대관령면"] },
      { sub: "평창평지", districts: ["평창읍", "미탄면", "방림면", "대화면", "봉평면", "용평면"] },
    ],
  },
  {
    parent: "홍천",
    rules: [
      { sub: "홍천산지", districts: ["내면"] },
      { sub: "홍천평지", districts: ["홍천읍", "화촌면", "두촌면", "내촌면", "서석면", "동면", "남면", "서면", "북방면"] },
    ],
  },
  {
    parent: "동해",
    rules: [
      { sub: "동해산지", districts: ["삼화동"] },
      { sub: "동해평지", districts: [] },
    ],
  },
  {
    parent: "삼척",
    rules: [
      { sub: "삼척평지", districts: ["원덕읍", "근덕면"] },
      { sub: "삼척산지", districts: ["도계읍", "미로면", "하장면", "노곡면", "가곡면", "신기면"] },
    ],
  },
  {
    parent: "정선",
    rules: [
      { sub: "정선평지", districts: ["정선읍", "신동읍", "남면"] },
      { sub: "정선산지", districts: ["여량면", "임계면", "북평면", "화암면", "사북읍", "고한읍"] },
    ],
  },
  {
    parent: "세종",
    rules: [
      { sub: "세종북부", districts: ["소정면", "전의면", "전동면", "조치원읍"] },
      { sub: "세종남부", districts: ["연서면", "연기면", "연동면", "부강면", "금남면", "장군면"] },
    ],
  },
  {
    parent: "청주",
    rules: [
      { sub: "청주동부", districts: ["낭성면", "미원면", "가덕면", "남일면", "문의면"] },
      { sub: "청주서부", districts: ["청원구", "흥덕구", "서원구", "상당구"] },
    ],
  },
  {
    parent: "홍성",
    rules: [
      { sub: "홍성서부", districts: ["은하면", "결성면", "서부면", "갈산면", "구항면"] },
      { sub: "홍성동부", districts: ["홍성읍", "광천읍", "홍북읍", "금마면", "홍동면", "장곡면"] },
    ],
  },
  {
    parent: "보령",
    rules: [
      { sub: "보령도서", districts: [] },
      { sub: "보령(도서제외)", districts: ["오천면"] },
    ],
  },
  {
    parent: "군산",
    rules: [
      { sub: "군산어청도", districts: [] },
      { sub: "군산옥도면(어청도 제외)", districts: ["옥도면"] },
      { sub: "군산(옥도면 제외)", districts: [] },
    ],
  },
  {
    parent: "부안",
    rules: [
      { sub: "부안위도면", districts: ["위도면"] },
      { sub: "부안(위도면 제외)", districts: [] },
    ],
  },
  {
    parent: "광주",
    rules: [
      { sub: "광주서부", districts: ["광산구"] },
      { sub: "광주동부", districts: ["동구", "서구", "남구", "북구"] },
    ],
  },
  {
    parent: "나주",
    rules: [
      { sub: "나주동남부", districts: ["세지면", "봉황면", "다도면"] },
      { sub: "나주서북부", districts: ["남평읍", "왕곡면", "반남면", "공산면", "동강면", "다시면", "문평면", "노안면", "금천면", "산포면"] },
    ],
  },
  {
    parent: "고흥",
    rules: [
      { sub: "고흥북부", districts: ["고흥읍", "두원면", "점암면", "과역면", "남양면", "동강면", "대서면"] },
      { sub: "고흥남부", districts: ["도양읍", "도덕면", "풍양면", "금산면", "도화면", "영남면", "포두면", "봉래면", "동일면"] },
    ],
  },
  {
    parent: "곡성",
    rules: [
      { sub: "곡성남부", districts: ["석곡면", "목사동면", "죽곡면"] },
      { sub: "곡성북부", districts: ["옥과면", "입면", "겸면", "오산면", "삼기면", "곡성읍", "오곡면", "고달면"] },
    ],
  },
  {
    parent: "해남",
    rules: [
      { sub: "해남남부", districts: ["화산면", "현산면", "송지면", "북평면", "북일면"] },
      { sub: "해남북부", districts: ["황산면", "산이면", "문내면", "화원면", "해남읍", "삼산면", "옥천면", "계곡면", "마산면"] },
    ],
  },
  {
    parent: "구례",
    rules: [
      { sub: "구례평지", districts: [] },
    ],
  },
  {
    parent: "무안",
    rules: [
      { sub: "무안남부", districts: ["일로읍", "삼향읍", "몽탄면"] },
      { sub: "무안북부", districts: ["해제면", "청계면", "현경면", "망운면", "운남면", "무안읍"] },
    ],
  },
  {
    parent: "완도",
    rules: [
      { sub: "완도여서도", districts: [] },
      { sub: "완도(여서도 제외)", districts: [] },
    ],
  },
  {
    parent: "영광",
    rules: [
      { sub: "영광낙월면", districts: ["낙월면"] },
      { sub: "영광(낙월면 제외)", districts: [] },
    ],
  },
  {
    parent: "대구",
    rules: [
      { sub: "군위", districts: ["군위군"] },
      { sub: "달성북부", districts: ["다사읍", "하빈면"] },
      { sub: "대구중부", districts: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구"] },
      { sub: "달성남부", districts: ["화원읍", "논공읍", "옥포읍", "가창면", "유가읍", "현풍읍", "구지면"] },
    ],
  },
  {
    // "달성" also exists as its own KMA_REGIONS node (unlike 인천/세종's
    // repeated-name intermediate node), so a 달성군 resident's city lookup
    // resolves straight to it instead of via the "대구" entry above — this
    // duplicate carries the identical districts so that path still refines.
    parent: "달성",
    rules: [
      { sub: "달성북부", districts: ["다사읍", "하빈면"] },
      { sub: "달성남부", districts: ["화원읍", "논공읍", "옥포읍", "가창면", "유가읍", "현풍읍", "구지면"] },
    ],
  },
  {
    parent: "봉화",
    rules: [
      { sub: "봉화산지", districts: ["석포면", "소천면", "재산면"] },
      { sub: "봉화평지", districts: ["봉화읍", "물야면", "봉성면", "법전면", "춘양면", "명호면", "상운면"] },
    ],
  },
  {
    parent: "울진",
    rules: [
      { sub: "울진산지", districts: ["금강송면"] },
      { sub: "울진평지", districts: ["울진읍", "평해읍", "북면", "근남면", "매화면", "기성면", "온정면", "죽변면", "후포면"] },
    ],
  },
  {
    parent: "영양",
    rules: [
      { sub: "영양산지", districts: ["수비면", "일월면"] },
      { sub: "영양평지", districts: ["영양읍", "입암면", "청기면", "석보면"] },
    ],
  },
  {
    parent: "경주",
    rules: [
      { sub: "경주남부", districts: ["외동읍", "내남면"] },
      { sub: "경주서부", districts: ["건천읍", "산내면", "서면"] },
      { sub: "경주동부", districts: ["감포읍", "문무대왕면", "양남면"] },
      { sub: "경주중북부", districts: ["안강읍", "강동면", "천북면", "현곡면"] },
    ],
  },
  {
    parent: "안동",
    rules: [
      { sub: "안동동남부", districts: ["임동면", "길안면", "임하면", "남선면"] },
      { sub: "안동북부", districts: ["도산면", "예안면", "녹전면", "와룡면", "북후면"] },
      { sub: "안동서부", districts: ["풍산읍", "서후면", "풍천면", "남후면", "일직면"] },
    ],
  },
  {
    parent: "김천",
    rules: [
      { sub: "김천남부", districts: ["조마면", "구성면", "지례면", "부항면", "대덕면", "증산면"] },
      { sub: "김천북부", districts: ["대항면", "봉산면", "어모면", "감문면", "개령면", "아포읍", "남면", "농소면", "감천면"] },
    ],
  },
  {
    parent: "부산",
    rules: [
      { sub: "부산중부", districts: ["금정구", "북구", "동래구", "연제구", "부산진구", "사상구"] },
      { sub: "부산서부", districts: ["강서구", "사하구", "서구", "중구", "동구", "영도구"] },
      { sub: "부산동부", districts: ["기장군", "해운대구", "수영구", "남구"] },
    ],
  },
  {
    parent: "울산",
    rules: [
      { sub: "울산동부", districts: ["북구", "중구", "남구", "동구"] },
      { sub: "울산서부", districts: ["울주군"] },
    ],
  },
  {
    parent: "하동",
    rules: [
      { sub: "하동북부", districts: ["화개면", "청암면", "악양면"] },
      { sub: "하동남부", districts: ["하동읍", "적량면", "횡천면", "고전면", "금남면", "진교면", "양보면", "북천면", "옥정면", "금성면"] },
    ],
  },
  {
    parent: "산청",
    rules: [
      { sub: "산청서남부", districts: ["삼장면", "시천면"] },
      { sub: "산청북부", districts: ["산청읍", "차황면", "오부면", "생초면", "금서면"] },
      { sub: "산청동남부", districts: ["단성면", "신안면", "생비량면", "신등면"] },
    ],
  },
  {
    parent: "함양",
    rules: [
      { sub: "함양서북부", districts: ["서상면", "서하면"] },
      { sub: "함양중부", districts: ["마천면", "함양읍", "휴천면", "유림면", "수동면", "지곡면", "안의면", "백전면", "병곡면"] },
    ],
  },
  {
    parent: "거창",
    rules: [
      { sub: "거창남부", districts: ["거창읍", "마리면", "남상면", "남하면", "신원면", "가조면"] },
      { sub: "거창북부", districts: ["주상면", "웅양면", "고제면", "북상면", "위천면", "가북면"] },
    ],
  },
  {
    parent: "합천",
    rules: [
      { sub: "합천남부", districts: ["쌍백면", "삼가면", "가회면"] },
      { sub: "합천서북부", districts: ["가야면", "야로면", "묘산면", "봉산면", "대병면"] },
      { sub: "합천중부", districts: ["합천읍", "용주면", "대양면", "율곡면", "쌍책면", "초계면", "적중면", "덕곡면", "청덕면"] },
    ],
  },
  {
    parent: "제주시(산지 제외)",
    rules: [
      { sub: "제주시동부", districts: ["구좌읍", "우도면"] },
      { sub: "제주시서부", districts: ["한림읍", "한경면"] },
      { sub: "제주시북부", districts: ["애월읍", "조천읍"] },
    ],
  },
  {
    parent: "서귀포시(산지 제외)",
    rules: [
      { sub: "서귀포시동부", districts: ["성산읍", "표선면"] },
      { sub: "서귀포시서부", districts: ["대정읍"] },
      { sub: "서귀포시남부", districts: ["안덕면", "남원읍"] },
    ],
  },
];

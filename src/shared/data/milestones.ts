export type MilestoneCamera = { lng: number; lat: number; zoom: number; bearing?: number; pitch?: number }

export type Milestone = {
  dateInt: number
  title: string
  desc: string
  url: string
  videoUrl?: string
  videoTimestamp?: number  // seconds into the video to start from
  videoLoop?: boolean      // loop after end (for short raw-footage clips)
  oblasts: number[]
  camera: MilestoneCamera
}

// All 27 Ukrainian oblasts (indices 1–27; 0 is unused/invalid in the geojson)
export const ALL_OBLASTS = Array.from({ length: 27 }, (_, i) => i + 1)

// Oblast index reference:
//  1 Cherkasy   2 Chernihiv   3 Chernivtsi   4 Crimea      5 Dnipropetrovsk
//  6 Donetsk    7 Ivano-Frank  8 Kharkiv      9 Kherson    10 Khmelnytsky
// 11 Kyiv obl  12 Kyiv City   13 Kirovohrad  14 Lviv       15 Luhansk
// 16 Mykolaiv  17 Odesa       18 Poltava     19 Rivne      20 Sevastopol
// 21 Sumy      22 Ternopil    23 Vinnytsia   24 Volyn      25 Zakarpattia
// 26 Zaporizhzhia  27 Zhytomyr

export const MILESTONES: Milestone[] = [
  {
    dateInt: 20220224,
    title: 'Full-scale invasion begins',
    desc: 'Russia launches simultaneous ground assaults from Belarus, Crimea, and the east. In the Black Sea, the garrison of Snake Island radios back: "Russian warship, go fuck yourself."',
    url: 'https://en.wikipedia.org/wiki/2022_Russian_invasion_of_Ukraine',
    videoUrl: 'https://www.youtube.com/watch?v=lJcVjy5ZwEE',
    oblasts: ALL_OBLASTS,
    camera: { lng: 31.1, lat: 48.8, zoom: 5, bearing: 0 },
  },
  {
    dateInt: 20220304,
    title: 'Zaporizhzhia nuclear plant seized',
    desc: 'Russian forces storm and capture Europe\'s largest nuclear power plant after overnight shelling causes fires at the facility.',
    url: 'https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant#2022_attack',
    videoUrl: 'https://www.youtube.com/watch?v=8HQcQg9EcOI',
    videoLoop: true,
    oblasts: [26],
    camera: { lng: 34.585, lat: 47.507, zoom: 10 },
  },
  {
    dateInt: 20220403,
    title: 'Bucha massacre revealed',
    desc: 'As Russian forces retreat from Kyiv Oblast, satellite images and journalists document mass civilian killings in Bucha — bodies in streets, evidence of torture, summary executions.',
    url: 'https://en.wikipedia.org/wiki/Bucha_massacre',
    videoUrl: 'https://www.youtube.com/watch?v=IrGZ66uKcl0',
    oblasts: [11],
    camera: { lng: 30.23, lat: 50.545, zoom: 12, bearing: -15 },
  },
  {
    dateInt: 20220408,
    title: 'Kramatorsk train station strike',
    desc: 'A Tochka-U missile hits a crowded evacuation hub at Kramatorsk station, killing 59 civilians and wounding over 100 waiting to flee the Donbas.',
    url: 'https://en.wikipedia.org/wiki/2022_Kramatorsk_train_station_attack',
    videoUrl: 'https://www.youtube.com/watch?v=Dl7NvpqHq40',
    oblasts: [6],
    camera: { lng: 37.56, lat: 48.725, zoom: 12 },
  },
  {
    dateInt: 20220414,
    title: 'Moskva cruiser sinks',
    desc: 'Russia\'s Black Sea Fleet flagship, struck two days earlier by Ukrainian Neptune anti-ship missiles, sinks in the Black Sea — the largest warship lost in combat since the Falklands War.',
    url: 'https://en.wikipedia.org/wiki/Russian_cruiser_Moskva',
    videoUrl: 'https://www.youtube.com/watch?v=OThae4aPaYM',
    videoLoop: true,
    oblasts: [17],
    camera: { lng: 31.0, lat: 45.8, zoom: 7, bearing: 10 },
  },
  {
    dateInt: 20220630,
    title: 'Snake Island liberated',
    desc: 'Ukraine recaptures Snake Island after months of strikes, forcing Russia to abandon its foothold and remove the threat to Odesa shipping lanes.',
    url: 'https://en.wikipedia.org/wiki/Snake_Island_campaign',
    videoUrl: 'https://www.youtube.com/watch?v=VxrQxrtA8ds',
    oblasts: [17],
    camera: { lng: 30.20, lat: 45.95, zoom: 9 },
  },
  {
    dateInt: 20220809,
    title: 'Saki airbase explosions',
    desc: 'A series of massive explosions destroys aircraft and munitions at Russia\'s Saki airbase in Crimea. Russia calls it an accident. Ukraine does not comment.',
    url: 'https://en.wikipedia.org/wiki/2022_Saki_air_base_explosions',
    videoUrl: 'https://www.youtube.com/watch?v=Ll5nGeUcuUI',
    videoLoop: true,
    oblasts: [4, 20],
    camera: { lng: 33.57, lat: 45.09, zoom: 10 },
  },
  {
    dateInt: 20220906,
    title: 'Kharkiv counteroffensive',
    desc: 'Ukraine launches a surprise offensive in Kharkiv Oblast, recapturing over 6,000 km² in days — the fastest advance of the entire war — and cutting off Russian supply lines in the north.',
    url: 'https://en.wikipedia.org/wiki/2022_Kharkiv_counteroffensive',
    videoUrl: 'https://www.youtube.com/watch?v=ZdEUicDjuhQ',
    oblasts: [8],
    camera: { lng: 37.3, lat: 49.2, zoom: 8, bearing: 5 },
  },
  {
    dateInt: 20221008,
    title: 'Kerch Bridge explosion',
    desc: 'A truck bomb collapses part of the Kerch Bridge — the symbol of Russia\'s annexation of Crimea — on Putin\'s birthday. Russia responds with mass missile strikes on Ukrainian cities.',
    url: 'https://en.wikipedia.org/wiki/2022_Kerch_Bridge_explosion',
    videoUrl: 'https://www.youtube.com/watch?v=fxgWCsampJg',
    videoLoop: true,
    oblasts: [4, 20],
    camera: { lng: 36.48, lat: 45.36, zoom: 11 },
  },
  {
    dateInt: 20221111,
    title: 'Kherson liberated',
    desc: 'Ukrainian forces enter Kherson city as Russian troops withdraw across the Dnipro river — the only regional capital Russia had seized during the full-scale invasion.',
    url: 'https://en.wikipedia.org/wiki/Kherson_offensive_(2022)',
    videoUrl: 'https://www.youtube.com/watch?v=uFQy065sMC0',
    oblasts: [9],
    camera: { lng: 32.62, lat: 46.64, zoom: 10 },
  },
  {
    dateInt: 20230114,
    title: 'Dnipro apartment strike',
    desc: 'A Russian Kh-22 missile strikes a residential apartment block in Dnipro, killing 46 civilians. One of the deadliest single strikes of the war on a civilian building.',
    url: 'https://en.wikipedia.org/wiki/2023_Dnipro_apartment_building_attack',
    videoUrl: 'https://www.youtube.com/watch?v=g6GZ1eA_hEI',
    oblasts: [5],
    camera: { lng: 35.04, lat: 48.46, zoom: 12 },
  },
  {
    dateInt: 20230125,
    title: 'Ukrainian POW executed on camera',
    desc: 'Video circulates showing Russian soldiers executing a captured Ukrainian soldier after he says "Slava Ukraini." The footage triggers international condemnation and war crimes investigations.',
    url: 'https://en.wikipedia.org/wiki/Prisoners_of_war_in_the_Russo-Ukrainian_war_(2022%E2%80%93present)#Execution_of_Oleksandr_Matsievskyi',
    oblasts: [6],
    camera: { lng: 38.2, lat: 48.1, zoom: 8 },
  },
  {
    dateInt: 20230520,
    title: 'Bakhmut falls',
    desc: 'After ten months of brutal urban combat — among the bloodiest fighting of the war — Wagner Group claims full control of Bakhmut. Casualties on both sides reach into the tens of thousands.',
    url: 'https://en.wikipedia.org/wiki/Battle_of_Bakhmut',
    videoUrl: 'https://www.youtube.com/watch?v=uGMzb45QJ4Y',
    oblasts: [6],
    camera: { lng: 37.99, lat: 48.60, zoom: 12 },
  },
  {
    dateInt: 20230606,
    title: 'Kakhovka dam destroyed',
    desc: 'The Kakhovka hydroelectric dam is blown up, flooding dozens of settlements downstream, destroying irrigation for hundreds of thousands of hectares, and triggering an ecological catastrophe.',
    url: 'https://en.wikipedia.org/wiki/Destruction_of_the_Kakhovka_dam',
    videoUrl: 'https://www.youtube.com/watch?v=hWmPvirid-Y',
    videoLoop: true,
    oblasts: [9, 26],
    camera: { lng: 33.37, lat: 47.21, zoom: 10 },
  },
  {
    dateInt: 20230624,
    title: 'Wagner mutiny',
    desc: 'Yevgeny Prigozhin launches an armed march on Moscow, seizing Rostov-on-Don and advancing within 200 km of the capital before halting under a deal brokered by Belarus. Prigozhin dies in a plane crash two months later.',
    url: 'https://en.wikipedia.org/wiki/Wagner_Group_rebellion',
    videoUrl: 'https://www.youtube.com/watch?v=_bZE6H8HevI',
    oblasts: [],
    camera: { lng: 36.0, lat: 50.0, zoom: 5, bearing: -5 },
  },
  {
    dateInt: 20240217,
    title: 'Avdiivka falls',
    desc: 'Ukraine withdraws from Avdiivka after months of encirclement pressure — Russia\'s most significant territorial gain since Bakhmut, at enormous cost in troops and equipment.',
    url: 'https://en.wikipedia.org/wiki/Battle_of_Avdiivka_(2023%E2%80%932024)',
    videoUrl: 'https://www.youtube.com/watch?v=E6Ll1lxcs3U',
    oblasts: [6],
    camera: { lng: 37.75, lat: 48.14, zoom: 11 },
  },
  {
    dateInt: 20240322,
    title: 'Crocus City Hall massacre',
    desc: 'ISIS-K gunmen storm a packed Moscow concert hall, killing 145 people. Russia dismisses the ISIS claim and uses the attack to justify intensified strikes on Ukraine.',
    url: 'https://en.wikipedia.org/wiki/2024_Crocus_City_Hall_attack',
    oblasts: [],
    camera: { lng: 31.1, lat: 48.8, zoom: 5 },
  },
  {
    dateInt: 20240708,
    title: 'Ohmatdyt children\'s hospital struck',
    desc: 'A Russian Kh-101 missile hits Kyiv\'s largest children\'s hospital during a mass missile attack on the capital, killing patients and staff and drawing global condemnation.',
    url: 'https://en.wikipedia.org/wiki/8_July_2024_Russian_strikes_on_Ukraine',
    videoUrl: 'https://www.youtube.com/watch?v=MIyeyGDQqE8',
    oblasts: [12],
    camera: { lng: 30.44, lat: 50.46, zoom: 13 },
  },
  {
    dateInt: 20240807,
    title: 'Ukraine crosses into Kursk Oblast',
    desc: 'Ukrainian forces launch a surprise cross-border offensive into Russia\'s Kursk Oblast — the first time a foreign army has occupied Russian territory since World War II.',
    url: 'https://en.wikipedia.org/wiki/2024_Kursk_Oblast_incursion',
    videoUrl: 'https://www.youtube.com/watch?v=nquCC3Hwkqs',
    oblasts: [21],
    camera: { lng: 34.8, lat: 51.4, zoom: 9, bearing: -10 },
  },
  {
    dateInt: 20241023,
    title: 'North Korean troops enter the war',
    desc: 'South Korean and US intelligence confirm that North Korea has dispatched roughly 10,000 soldiers to fight alongside Russian forces in Kursk — a dramatic internationalisation of the conflict.',
    url: 'https://en.wikipedia.org/wiki/North_Korean_involvement_in_the_Russian_invasion_of_Ukraine',
    videoUrl: 'https://www.youtube.com/watch?v=WEVwY3XkTrI',
    oblasts: [],
    camera: { lng: 34.2, lat: 51.2, zoom: 7 },
  },
  {
    dateInt: 20241121,
    title: 'Russia fires Oreshnik hypersonic missile',
    desc: 'Russia launches the Oreshnik — an experimental intermediate-range ballistic missile — at Dnipro, marking its combat debut and threatening to escalate the missile war to a new level.',
    url: 'https://en.wikipedia.org/wiki/Oreshnik_(missile)',
    videoUrl: 'https://www.youtube.com/watch?v=3T4ZNUjDhug',
    videoLoop: true,
    oblasts: [5],
    camera: { lng: 35.04, lat: 48.46, zoom: 10 },
  },
  {
    dateInt: 20250228,
    title: 'Trump–Zelensky Oval Office clash',
    desc: 'In a televised confrontation, President Trump and Vice President Vance publicly berate Zelensky in the Oval Office. The US suspends military aid and intelligence sharing with Ukraine days later.',
    url: 'https://en.wikipedia.org/wiki/2025_Trump%E2%80%93Zelenskyy_Oval_Office_meeting',
    oblasts: [],
    camera: { lng: 31.1, lat: 48.8, zoom: 5 },
  },
  {
    dateInt: 20250430,
    title: 'US–Ukraine minerals deal signed',
    desc: 'Washington and Kyiv sign a strategic minerals partnership giving the US preferential access to Ukraine\'s rare earth and critical mineral deposits in exchange for continued support.',
    url: 'https://en.wikipedia.org/wiki/Ukraine%E2%80%93United_States_Mineral_Resources_Agreement',
    oblasts: [],
    camera: { lng: 31.1, lat: 48.8, zoom: 5 },
  },
]

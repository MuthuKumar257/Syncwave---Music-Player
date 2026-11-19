export type MusicLanguage =
  | 'Tamil'
  | 'Telugu'
  | 'Hindi'
  | 'Malayalam'
  | 'Kannada'
  | 'Bengali'
  | 'Marathi'
  | 'Punjabi'
  | 'English'
  | 'Instrumental'
  | 'Other';

export type SongVersionType =
  | 'ORIGINAL'
  | 'OFFICIAL_VIDEO'
  | 'REMIX'
  | 'COVER'
  | 'LIVE'
  | 'INSTRUMENTAL'
  | 'ACOUSTIC'
  | 'KARAOKE'
  | 'BGM';

// Well-known Indian cinema composers and their alias variants
export const COMPOSER_ALIASES: Record<string, string[]> = {
  'A. R. Rahman': ['ar rahman', 'a.r. rahman', 'a.r.rahman', 'rahman', 'allah rakha rahman', 'ஏ. ஆர். ரகுமான்'],
  'Harris Jayaraj': ['harris jayaraj', 'harris jayraj', 'harris', 'ஹாரிஸ் ஜெயராஜ்'],
  'Anirudh Ravichander': ['anirudh', 'anirudh ravichander', 'ani', 'அனிருத்'],
  'Ilaiyaraaja': ['ilaiyaraaja', 'ilayaraja', 'illayaraja', 'isaignani', 'இளையராஜா'],
  'Yuvan Shankar Raja': ['yuvan shankar raja', 'yuvan', 'u1', 'யுவன் சங்கர் ராஜா'],
  'Santhosh Narayanan': ['santhosh narayanan', 'santhosh', 'sana', 'சந்தோஷ் நாராயணன்'],
  'G. V. Prakash Kumar': ['g.v. prakash', 'gv prakash', 'gv prakash kumar'],
  'M. M. Keeravani': ['keeravani', 'm.m. keeravani', 'mm keeravani', 'maragathamani'],
  'Devi Sri Prasad': ['devi sri prasad', 'dsp'],
  'Thaman S': ['thaman', 'thaman s', 's. thaman'],
  'Pritam': ['pritam', 'pritam chakraborty'],
  'Arijit Singh': ['arijit singh', 'arijit'],
  'Sid Sriram': ['sid sriram'],
  'S. P. Balasubrahmanyam': ['sp balasubrahmanyam', 'spb', 's.p.b', 'எஸ். பி. பாலசுப்பிரமணியம்'],
  'K. J. Yesudas': ['k.j. yesudas', 'yesudas', 'kj yesudas', 'ஜேசுதாஸ்'],
  'Shreya Ghoshal': ['shreya ghoshal', 'shreya ghosal'],
  'K. S. Chithra': ['k.s. chithra', 'ks chithra', 'chithra']
};

// Known movie databases / aliases for high-confidence soundtrack identification
export const KNOWN_INDIAN_MOVIES: Array<{
  movieName: string;
  aliases: string[];
  composer: string;
  year: number;
  language: MusicLanguage;
  leadSingers: string[];
  trackTitles: string[];
}> = [
  {
    movieName: 'Vaaranam Aayiram',
    aliases: ['vaaranam aayiram', 'varanam aayiram', 'varanam ayiram', 'வாரணம் ஆயிரம்'],
    composer: 'Harris Jayaraj',
    year: 2008,
    language: 'Tamil',
    leadSingers: ['Hariharan', 'Krish', 'Naresh Iyer', 'Benny Dayal', 'Shruti Haasan', 'Bombay Jayashri'],
    trackTitles: [
      'Nenjukkul Peidhidum',
      'Mundhinam Paarthenae',
      'Ava Enna Enna Thedi Vandha Anjala',
      'Adiye Kolluthey',
      'Yethi Yethi',
      'Annul Maelae',
      'Oh Shanthi'
    ]
  },
  {
    movieName: 'Leo',
    aliases: ['leo', 'leo bloody sweet', 'லியோ'],
    composer: 'Anirudh Ravichander',
    year: 2023,
    language: 'Tamil',
    leadSingers: ['Thalapathy Vijay', 'Anirudh Ravichander', 'Asal Kolaar'],
    trackTitles: ['Naa Ready', 'Badass', 'Anbenum', 'I\'m Scared', 'Bloody Sweet', 'Villain Yaaru']
  },
  {
    movieName: 'Roja',
    aliases: ['roja', 'ரோஜா'],
    composer: 'A. R. Rahman',
    year: 1992,
    language: 'Tamil',
    leadSingers: ['S. P. Balasubrahmanyam', 'K. S. Chithra', 'Hariharan', 'Minmini', 'Sujatha'],
    trackTitles: ['Chinna Chinna Aasai', 'Pudhu Vellai Mazhai', 'Kaadhal Rojave', 'Rukkumani Rukkumani', 'Thamizha Thamizha']
  },
  {
    movieName: 'Kadal',
    aliases: ['kadal', 'கடல்'],
    composer: 'A. R. Rahman',
    year: 2013,
    language: 'Tamil',
    leadSingers: ['Sid Sriram', 'A. R. Rahman', 'Haricharan', 'Abhay Jodhpurkar', 'Shakthisree Gopalan'],
    trackTitles: ['Adiye', 'Nenjukkulle', 'Elay Keechan', 'Moongil Thottam', 'Anbin Vasale']
  },
  {
    movieName: 'Brahmastra',
    aliases: ['brahmastra', 'brahmāstra', 'brahmastra part one shiva'],
    composer: 'Pritam',
    year: 2022,
    language: 'Hindi',
    leadSingers: ['Arijit Singh', 'Shreya Ghoshal', 'Badshah', 'Jonita Gandhi'],
    trackTitles: ['Kesariya', 'Deva Deva', 'Dance Ka Bhoot', 'Rasiya', 'Fitoor']
  },
  {
    movieName: 'Ala Vaikunthapurramuloo',
    aliases: ['ala vaikunthapurramuloo', 'ala vaikuntapuramlo', 'avpl'],
    composer: 'Thaman S',
    year: 2020,
    language: 'Telugu',
    leadSingers: ['Sid Sriram', 'Armaan Malik', 'Ramya Behara', 'Anurag Kulkarni'],
    trackTitles: ['Samajavaragamana', 'Ramuloo Ramulaa', 'ButtaBomma', 'OMG Daddy', 'Sittharala Sirapadu']
  },
  {
    movieName: 'RRR',
    aliases: ['rrr', 'rrr movie', 'rise roar revolt'],
    composer: 'M. M. Keeravani',
    year: 2022,
    language: 'Telugu',
    leadSingers: ['Rahul Sipligunj', 'Kaala Bhairava', 'MM Keeravani', 'Vishal Mishra'],
    trackTitles: ['Naatu Naatu', 'Dosti', 'Komuram Bheemudo', 'Raamam Raaghavam', 'Janani', 'Etthara Jenda']
  },
  {
    movieName: 'Jawan',
    aliases: ['jawan', 'jawaan'],
    composer: 'Anirudh Ravichander',
    year: 2023,
    language: 'Hindi',
    leadSingers: ['Arijit Singh', 'Anirudh Ravichander', 'Shilpa Rao', 'Vishal Dadlani'],
    trackTitles: ['Chaleya', 'Zinda Banda', 'Not Ramaiya Vastavaiya', 'Aararaari Raaro', 'Jawan Title Track']
  },
  {
    movieName: 'Dil Se..',
    aliases: ['dil se', 'dil se..'],
    composer: 'A. R. Rahman',
    year: 1998,
    language: 'Hindi',
    leadSingers: ['Sukhwinder Singh', 'Sapna Awasthi', 'Lata Mangeshkar', 'Udit Narayan', 'Kavita Krishnamurthy'],
    trackTitles: ['Chaiyya Chaiyya', 'Dil Se Re', 'Jiya Jale', 'Satrangi Re', 'Ae Ajnabi']
  },
  {
    movieName: 'Kantara',
    aliases: ['kantara', 'kantara a legend'],
    composer: 'B. Ajaneesh Loknath',
    year: 2022,
    language: 'Kannada',
    leadSingers: ['Vijay Prakash', 'Haricharan', 'B Ajaneesh Loknath'],
    trackTitles: ['Varaha Roopam', 'Singara Siriye', 'Rebel Song', 'Karma Song']
  },
  {
    movieName: 'Premam',
    aliases: ['premam'],
    composer: 'Rajesh Murugesan',
    year: 2015,
    language: 'Malayalam',
    leadSingers: ['Vijay Yesudas', 'Vineeth Sreenivasan', 'Shabareesh Varma'],
    trackTitles: ['Malare', 'Aluva Puzha', 'Scene Contra', 'Kalippu', 'Kaalam Kettu Poyi', 'Pathivayi Njan']
  },
  {
    movieName: 'Vinnaithaandi Varuvaayaa',
    aliases: ['vinnaithaandi varuvaayaa', 'vtv', 'vinnaithaandi varuvaya'],
    composer: 'A. R. Rahman',
    year: 2010,
    language: 'Tamil',
    leadSingers: ['Vijay Prakash', 'Suzanne D\'Mello', 'Shreya Ghoshal', 'Alphons Joseph'],
    trackTitles: ['Hosanna', 'Aaromale', 'Mannipaaya', 'Anbil Avan', 'Omana Penne', 'Kannukkul Kannai']
  },
  {
    movieName: 'Pushpa: The Rise',
    aliases: ['pushpa', 'pushpa the rise', 'pushpa 1'],
    composer: 'Devi Sri Prasad',
    year: 2021,
    language: 'Telugu',
    leadSingers: ['Sid Sriram', 'Indravathi Chauhan', 'Mounika Yadav', 'Javed Ali'],
    trackTitles: ['Srivalli', 'Oo Antava Oo Oo Antava', 'Saami Saami', 'Eyy Bidda Idhi Naa Adda', 'Daakko Daakko Meka']
  },
  {
    movieName: 'Aashiqui 2',
    aliases: ['aashiqui 2', 'aashiqui'],
    composer: 'Mithoon',
    year: 2013,
    language: 'Hindi',
    leadSingers: ['Arijit Singh', 'Shreya Ghoshal', 'Ankit Tiwari'],
    trackTitles: ['Tum Hi Ho', 'Sunn Raha Hai', 'Chahun Main Ya Naa', 'Milne Hai Mujhse Aayi', 'Hum Mar Jayenge']
  },
  {
    movieName: 'Kumbalangi Nights',
    aliases: ['kumbalangi nights', 'kumbalangi'],
    composer: 'Sushin Shyam',
    year: 2019,
    language: 'Malayalam',
    leadSingers: ['Sithara Krishnakumar', 'Sooraj Santhosh', 'Anne Amie'],
    trackTitles: ['Cherathukal', 'Uyiril Thodum', 'Silent Cat', 'Ezhutha Katha']
  },
  {
    movieName: 'Sairat',
    aliases: ['sairat', 'सैराट'],
    composer: 'Ajay-Atul',
    year: 2016,
    language: 'Marathi',
    leadSingers: ['Ajay Gogavale', 'Shreya Ghoshal', 'Chinmayi Sripaada'],
    trackTitles: ['Zingaat', 'Yad Lagla', 'Sairat Zaala Ji', 'Aatach Baya Ka Baavarla']
  },
  {
    movieName: 'Qismat',
    aliases: ['qismat'],
    composer: 'B Praak',
    year: 2018,
    language: 'Punjabi',
    leadSingers: ['Ammy Virk', 'B Praak', 'Gurnam Bhullar', 'Kamal Khan'],
    trackTitles: ['Kaun Hoyega', 'Fakira', 'Dholna', 'Awaaz', 'Gallan Teriyan']
  },
  {
    movieName: 'Global Billboard Hits',
    aliases: ['global hits', 'billboard hits', 'english hits'],
    composer: 'Various International Artists',
    year: 2023,
    language: 'English',
    leadSingers: ['The Weeknd', 'Ed Sheeran', 'Coldplay', 'Harry Styles', 'Dua Lipa'],
    trackTitles: ['Blinding Lights', 'Shape of You', 'Viva La Vida', 'As It Was', 'Levitating']
  },
  {
    movieName: 'Appuchi Graamam',
    aliases: ['appuchi graamam', 'appuchi gramam', 'appuchi', 'அப்புச்சி கிராமம்'],
    composer: 'Vishal Chandrasekhar',
    year: 2014,
    language: 'Tamil',
    leadSingers: ['Varun Vishwa', 'Vishal Chandrasekhar'],
    trackTitles: ['En Kannu Kulla', 'En Kannukulla', 'Appuchi Graamam Theme']
  }
];

// Well-defined song themes for mood & vibe discovery
export interface SongThemeDefinition {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  trackTitles: string[];
}

export const SONG_THEMES: SongThemeDefinition[] = [
  {
    id: 'love',
    name: 'Love & Romance',
    description: 'Heartwarming romantic melodies, love hits and duets',
    aliases: ['love', 'romantic', 'romance', 'kadhal', 'kaadhal', 'prema', 'pyar', 'ishq', 'love songs', 'love feeling', 'love melody', 'couple', 'crush', 'valentine', 'romantic hits', 'duet', 'love track', 'love tracks', 'romantic songs'],
    trackTitles: [
      'En Kannu Kulla',
      'En Kannukulla',
      'Nenjukkul Peidhidum',
      'Mundhinam Paarthenae',
      'Hosanna',
      'Mannipaaya',
      'Malare',
      'Pudhu Vellai Mazhai',
      'Kaadhal Rojave',
      'Samajavaragamana',
      'ButtaBomma',
      'Tum Hi Ho',
      'Chaleya',
      'Srivalli',
      'Uyiril Thodum',
      'Cherathukal',
      'Kaun Hoyega',
      'Shape of You',
      'As It Was'
    ]
  },
  {
    id: 'sad',
    name: 'Sad & Breakup',
    description: 'Emotional heartbreaks, melancholy tunes and soulful ballads',
    aliases: ['sad', 'breakup', 'heartbreak', 'crying', 'pain', 'alone', 'soga', 'sogam', 'soga padalgal', 'tears', 'sad songs', 'sad feeling', 'break up', 'crying songs'],
    trackTitles: [
      'Ava Enna Enna Thedi Vandha Anjala',
      'Kaadhal Rojave',
      'Sunn Raha Hai',
      'Chahun Main Ya Naa',
      'Hum Mar Jayenge',
      'Komuram Bheemudo',
      'Kaun Hoyega',
      'Fakira',
      'Awaaz',
      'Aaromale',
      'Janani'
    ]
  },
  {
    id: 'party',
    name: 'Party & Dance',
    description: 'High-energy dance anthems, kuthu beats and club bangers',
    aliases: ['party', 'dance', 'kuthu', 'dappan kuthu', 'mass', 'dj', 'club', 'beat', 'fast', 'party songs', 'dance songs', 'energetic', 'celebration', 'mass songs', 'fast beat', 'kuthu songs'],
    trackTitles: [
      'Naa Ready',
      'Badass',
      'Naatu Naatu',
      'Zingaat',
      'Oo Antava Oo Oo Antava',
      'Saami Saami',
      'Zinda Banda',
      'Not Ramaiya Vastavaiya',
      'Ramuloo Ramulaa',
      'Adiye Kolluthey',
      'Yethi Yethi',
      'Chaiyya Chaiyya',
      'Levitating',
      'Blinding Lights'
    ]
  },
  {
    id: 'melody',
    name: 'Melody & Chill',
    description: 'Soothing acoustic harmonies, calm vibes and relaxing acoustics',
    aliases: ['melody', 'chill', 'peaceful', 'calm', 'relaxing', 'relax', 'sleep', 'night', 'lullaby', 'soothing', 'melody songs', 'soft songs', 'relaxing songs', 'chill songs', 'night songs'],
    trackTitles: [
      'En Kannu Kulla',
      'En Kannukulla',
      'Pudhu Vellai Mazhai',
      'Chinna Chinna Aasai',
      'Cherathukal',
      'Silent Cat',
      'Malare',
      'Aluva Puzha',
      'Annul Maelae',
      'Satrangi Re',
      'Ae Ajnabi',
      'Omana Penne'
    ]
  },
  {
    id: 'workout',
    name: 'Workout & Motivation',
    description: 'Pumping beats and motivational soundtracks to fuel your gym sessions',
    aliases: ['workout', 'gym', 'motivation', 'motivational', 'fitness', 'power', 'energy', 'running', 'beast', 'training', 'workout songs', 'gym songs', 'motivational songs'],
    trackTitles: [
      'Badass',
      'Naa Ready',
      'Zinda Banda',
      'Dosti',
      'Raamam Raaghavam',
      'Etthara Jenda',
      'Dil Se Re',
      'Eyy Bidda Idhi Naa Adda',
      'Rebel Song',
      'Karma Song',
      'Viva La Vida'
    ]
  },
  {
    id: 'devotional',
    name: 'Devotional & Spiritual',
    description: 'Sacred chants, divine compositions and spiritual tranquility',
    aliases: ['devotional', 'bhakti', 'spiritual', 'god', 'divine', 'prayer', 'temple', 'pooja', 'sloka', 'devotional songs', 'bhakti songs'],
    trackTitles: [
      'Varaha Roopam',
      'Singara Siriye',
      'Raamam Raaghavam',
      'Janani',
      'Thamizha Thamizha'
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Road Trip',
    description: 'Wanderlust soundtracks for open highways, sunsets and road trips',
    aliases: ['travel', 'road trip', 'driving', 'drive', 'journey', 'highway', 'car songs', 'trip', 'travel songs', 'road trip songs'],
    trackTitles: [
      'Chaiyya Chaiyya',
      'Hosanna',
      'Mundhinam Paarthenae',
      'Samajavaragamana',
      'As It Was',
      'Blinding Lights'
    ]
  },
  {
    id: 'rain',
    name: 'Rain & Monsoon',
    description: 'Misty raindrops, monsoon romance and thunderous melodies',
    aliases: ['rain', 'monsoon', 'mazhai', 'varsham', 'rain songs', 'monsoon hits', 'mazhai songs'],
    trackTitles: [
      'Nenjukkul Peidhidum',
      'Pudhu Vellai Mazhai',
      'Malare'
    ]
  },
  {
    id: 'folk',
    name: 'Folk & Traditional',
    description: 'Rooted village rhythms, indigenous beats and folk heritage',
    aliases: ['folk', 'nattupura', 'desi', 'traditional', 'village', 'folk songs', 'desi songs'],
    trackTitles: [
      'Varaha Roopam',
      'Singara Siriye',
      'Ramuloo Ramulaa',
      'Saami Saami',
      'Zingaat',
      'Rukkumani Rukkumani'
    ]
  }
];

// Curated verified YouTube Video IDs for complete, full-length songs (NOT 30-second previews)
export const KNOWN_TRACK_VIDEO_MAP: Record<string, string> = {
  // Vaaranam Aayiram
  'Nenjukkul Peidhidum': 'FzLpP8VBC6E',
  'Mundhinam Paarthenae': '93iK4wNij8E',
  'Ava Enna Enna Thedi Vandha Anjala': '5yjy7djTUDc',
  'Adiye Kolluthey': 'oNTOpHEpGiA',
  'Yethi Yethi': 'fnGxSyeh8YQ',
  'Annul Maelae': 'eG5Zx7qq2C4',
  'Oh Shanthi': 'jnxTNyxBHRk',

  // Leo
  'Naa Ready': 'szvt1vD0Uug',
  'Badass': 'ZdMZ40GSVmc',
  'Anbenum': 'G9bat9nqX0Q',
  "I'm Scared": '0VRuesp4UYk',
  'Bloody Sweet': 'qN3wfuPYTI4',
  'Villain Yaaru': 'M694ziOHze0',

  // Roja
  'Chinna Chinna Aasai': 'nPhnTTQkTG0',
  'Pudhu Vellai Mazhai': 'YTlXr4g9fgc',
  'Kaadhal Rojave': 'skqEJTls7e8',
  'Rukkumani Rukkumani': 'yZKqNFFQu8w',
  'Thamizha Thamizha': 'ul6DtfObimw',

  // Ala Vaikunthapurramuloo
  'Samajavaragamana': 'OCg6BWlAXSw',
  'Ramuloo Ramulaa': 'Bg8Yb9zGYyA',
  'ButtaBomma': '2mDCVzruYzQ',
  'OMG Daddy': 'gdt-yIgm2zc',
  'Sittharala Sirapadu': 'yWG5bYvKARE',

  // RRR
  'Naatu Naatu': '79IEesucPo8',
  'Dosti': 'k157GjJHvK4',
  'Komuram Bheemudo': 'uBDCl5c-9qM',
  'Raamam Raaghavam': 'Cn-o7RzUPpU',
  'Janani': 'WEBvHPvf0hM',
  'Etthara Jenda': 'GoO4PXkCIEc',

  // Jawan
  'Chaleya': 'VAdGW7QDJiU',
  'Zinda Banda': 'stjZKBhQ3lg',
  'Not Ramaiya Vastavaiya': 'm3OtL4peEWU',
  'Aararaari Raaro': 'cTtUOtiVUXQ',
  'Jawan Title Track': 'EiScA8DlzLA',

  // Dil Se..
  'Chaiyya Chaiyya': 'K-pX4qwtAxA',
  'Dil Se Re': 'U3hZW62-KGA',
  'Jiya Jale': '6y3VCPwAKhM',
  'Satrangi Re': '33cQdeFhNgU',
  'Ae Ajnabi': 'gga4bIVcA-A',

  // Kantara
  'Varaha Roopam': 'm-5ck3BuT1o',
  'Singara Siriye': '2nT5mg9AlT4',
  'Rebel Song': 'X82X7L-E0kU',
  'Karma Song': 'FShKyGV8qQE',

  // Premam
  'Malare': '0G2VxhV_gXM',
  'Aluva Puzha': 'fiAlruU48HI',
  'Scene Contra': 'WYtnfsDJ6IA',
  'Kalippu': 'PeUjir1kMFM',
  'Kaalam Kettu Poyi': 'ikba2CZSvh4',
  'Pathivayi Njan': '1DF1nOfUIaU',

  // Vinnaithaandi Varuvaayaa
  'Hosanna': 'YFYiTS46x-8',
  'Aaromale': 'q7OUFE3dw6E',
  'Mannipaaya': 'EjUP08N89mI',
  'Anbil Avan': 'bXa-wbiXiOw',
  'Omana Penne': 'vj2_z1GYXcU',
  'Kannukkul Kannai': 'TD1mHl9mUN4',

  // Pushpa: The Rise
  'Srivalli': 'hcMzwMrr1tE',
  'Oo Antava Oo Oo Antava': 'u_wB6byrl5k',
  'Saami Saami': 'vdY5SFZBgnk',
  'Eyy Bidda Idhi Naa Adda': 'jGetqo_SC9U',
  'Daakko Daakko Meka': 'pc_784hcQxI',

  // Aashiqui 2
  'Tum Hi Ho': 'IJq0yyWug1k',
  'Sunn Raha Hai': 'eHRrZ5DQCV4',
  'Chahun Main Ya Naa': 'VdyBtGaspss',
  'Milne Hai Mujhse Aayi': 'GtPvCa3vvxA',
  'Hum Mar Jayenge': 'krJsyb_yf7A',

  // Brahmastra
  'Kesariya': 'BddP6PYo2gs',
  'Deva Deva': 'mNuhKUOD_A0',
  'Dance Ka Bhoot': 'xfMN4SpIxIA',
  'Rasiya': 'F_oNAi5DcEU',
  'Fitoor': 'hdNg1TAtAHg',

  // Kadal
  'Adiye': 'X-Ilp8QNNfQ',
  'Nenjukkulle': 'XYZwp-WAg6I',

  // Kumbalangi Nights
  'Cherathukal': 'kAP72G5R4H8',
  'Uyiril Thodum': 'ZKhOs_Pc_7s',
  'Silent Cat': 'JIT4Spkp1yw',
  'Ezhutha Katha': '3m771nxuhaA',

  // Sairat
  'Zingaat': '5AeX7Ddq4ts',
  'Yad Lagla': 'T6w78g0gihM',
  'Sairat Zaala Ji': 'ZL3MnrnLLpo',
  'Aatach Baya Ka Baavarla': 'wlCfJX9QW3w',

  // Qismat
  'Kaun Hoyega': 'wXhTHyIgQ_U',
  'Fakira': 'FyQ3tOumRew',
  'Dholna': '2xMgo3f5RT8',
  'Awaaz': 'KCPDJ3YV6eU',
  'Gallan Teriyan': 'irJpGGZpH5Q',

  // Global Hits
  'Blinding Lights': '4NRXx6U8ABQ',
  'Shape of You': 'JGwWNGJdvx8',
  'Viva La Vida': 'dvgZkm1xWPE',
  'As It Was': 'H5v3kku4y6Q',
  'Levitating': 'TUVcZfQe-Kw',

  // Appuchi Graamam
  'En Kannu Kulla': 'qC-X5MogTI0',
  'En Kannukulla': 'qC-X5MogTI0',
  'Appuchi Graamam Theme': 'qC-X5MogTI0'
};

export function getOriginalTrackArtwork(title: string, videoId?: string): string {
  const vid = videoId || KNOWN_TRACK_VIDEO_MAP[title];
  if (vid) {
    return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
  }
  return 'https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg';
}

export class IndianCinemaHelper {
  /**
   * Detects regional language from query, script, or composer/movie hints
   */
  static detectLanguage(text: string): MusicLanguage {
    const t = text.toLowerCase();

    // Unicode script checks
    if (/[\u0B80-\u0BFF]/.test(text)) return 'Tamil';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'Telugu';
    if (/[\u0D00-\u0D7F]/.test(text)) return 'Malayalam';
    if (/[\u0C80-\u0CFF]/.test(text)) return 'Kannada';
    if (/[\u0900-\u097F]/.test(text)) return 'Hindi'; // Devanagari (Hindi/Marathi)
    if (/[\u0980-\u09FF]/.test(text)) return 'Bengali';
    if (/[\u0A00-\u0A7F]/.test(text)) return 'Punjabi';

    // Transliteration / keyword checks
    if (t.includes('tamil') || t.includes('kollywood')) return 'Tamil';
    if (t.includes('telugu') || t.includes('tollywood')) return 'Telugu';
    if (t.includes('hindi') || t.includes('bollywood')) return 'Hindi';
    if (t.includes('malayalam') || t.includes('mollywood')) return 'Malayalam';
    if (t.includes('kannada') || t.includes('sandalwood')) return 'Kannada';
    if (t.includes('punjabi')) return 'Punjabi';
    if (t.includes('bengali')) return 'Bengali';
    if (t.includes('marathi')) return 'Marathi';
    if (t.includes('english') || t.includes('global') || t.includes('billboard') || t.includes('hollywood') || t.includes('weeknd') || t.includes('sheeran') || t.includes('swift') || t.includes('coldplay')) return 'English';

    // Check movie matches
    for (const m of KNOWN_INDIAN_MOVIES) {
      if (m.aliases.some((alias) => t.includes(alias))) {
        return m.language;
      }
    }

    return 'Other';
  }

  /**
   * Normalizes composer name to canonical format
   */
  static normalizeComposer(name: string): string {
    const lower = name.toLowerCase().trim();
    for (const [canonical, aliases] of Object.entries(COMPOSER_ALIASES)) {
      if (aliases.some((alias) => lower.includes(alias))) {
        return canonical;
      }
    }
    return name.trim();
  }

  /**
   * Classifies song recording into version type based on title keywords and attributes
   */
  static classifyVersion(title: string, artist: string = ''): SongVersionType {
    const combined = `${title} ${artist}`.toLowerCase();

    if (/\b(official\s+video|music\s+video|video\s+song|mv)\b/i.test(combined)) {
      return 'OFFICIAL_VIDEO';
    }
    if (/\b(remix|dj\s+mix|re-mix|club\s+mix|edm\s+mix|trap\s+mix)\b/i.test(combined)) {
      return 'REMIX';
    }
    if (/\b(live|concert|in\s+concert|unplugged|stage\s+performance)\b/i.test(combined)) {
      return 'LIVE';
    }
    if (/\b(cover|rendition|tribute|reprise|sung\s+by)\b/i.test(combined)) {
      return 'COVER';
    }
    if (/\b(instrumental|karaoke|backing\s+track|minus\s+one|bgm|piano|guitar|violin|flute)\b/i.test(combined)) {
      if (/\b(karaoke|minus\s+one)\b/i.test(combined)) return 'KARAOKE';
      if (/\b(bgm|theme\s+music|score)\b/i.test(combined)) return 'BGM';
      return 'INSTRUMENTAL';
    }
    if (/\b(acoustic|unplugged)\b/i.test(combined)) {
      return 'ACOUSTIC';
    }

    return 'ORIGINAL';
  }

  /**
   * Checks if query matches a known movie and returns movie details
   */
  static findKnownMovie(query: string) {
    const q = query.toLowerCase().trim();
    for (const m of KNOWN_INDIAN_MOVIES) {
      if (m.aliases.some((alias) => q.includes(alias) || alias.includes(q))) {
        return m;
      }
    }
    return null;
  }

  /**
   * Checks if query matches a known song theme / mood
   */
  static findTheme(query: string): SongThemeDefinition | null {
    const q = query.toLowerCase().trim();
    // 1. Direct or substring alias match
    for (const theme of SONG_THEMES) {
      if (theme.aliases.some((alias) => q === alias || q.includes(alias) || alias.includes(q))) {
        return theme;
      }
    }
    // 2. Token match for compound theme queries (e.g. "love tamil songs", "romantic melody", "tamil sad songs")
    const words = q.split(/\s+/);
    for (const theme of SONG_THEMES) {
      if (theme.aliases.some((alias) => words.includes(alias))) {
        return theme;
      }
    }
    return null;
  }
}

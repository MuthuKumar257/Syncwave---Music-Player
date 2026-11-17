import { ArtistItem } from './artistCatalog.data';

export interface CanonicalArtist {
  id: string;
  canonicalName: string;
  name: string; // for backward compatibility with ArtistItem
  category: 'ARTIST';
  role: 'DIRECTOR' | 'SINGER' | 'ALL';
  roleTitle: string;
  languages: string[];
  imageUrl: string;
  description: string;
  aliases: string[];
  knownFor: string[];
  popularTracks: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedArtistsResponse {
  artists: CanonicalArtist[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  selectedLanguages: string[];
}

/**
 * Normalizes artist names across English and regional Indic scripts:
 * - NFKC Unicode normalization
 * - Trims leading & trailing whitespace
 * - Collapses consecutive spaces
 * - Lowercases Latin characters
 * - Strips punctuation marks (dots, commas, hyphens, brackets) while preserving Indic Unicode glyphs
 */
export function normalizeArtistName(input?: string): string {
  if (!input) return '';
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\.\,\(\)\[\]\-_/\\|;:'"!@#$%^&*~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Standard supported music languages across SyncWave
 */
export const SUPPORTED_MUSIC_LANGUAGES = [
  'Tamil',
  'Telugu',
  'Hindi',
  'Malayalam',
  'Kannada',
  'Punjabi',
  'Bengali',
  'Marathi',
  'English'
] as const;

export type SupportedLanguage = (typeof SUPPORTED_MUSIC_LANGUAGES)[number];

// Master Seed of Comprehensive Multilingual Canonical Artists
const INITIAL_CANONICAL_ARTISTS: CanonicalArtist[] = [
  // =========================================================================
  // TAMIL & CROSS-LINGUAL DIRECTORS
  // =========================================================================
  {
    id: 'art_ar_rahman',
    canonicalName: 'A. R. Rahman',
    name: 'A. R. Rahman',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Hindi', 'Telugu', 'English', 'Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/bd34315ef977a62a9e28c1ab19bb8ac4/500x500-000000-80-0-0.jpg',
    description: 'Academy Award and Grammy-winning composer, pioneer of modern Indian cinema music.',
    aliases: [
      'AR Rahman',
      'A.R. Rahman',
      'A.R.Rahman',
      'Rahman',
      'Allah Rakha Rahman',
      'A S Dileep Kumar',
      'ஏ. ஆர். ரகுமான்',
      'ए. आर. रहमान',
      'ఎ. ఆర్. రెహమాన్',
      'എ. ആർ. റഹ്മാൻ'
    ],
    knownFor: ['Roja', 'Dil Se..', 'Ponniyin Selvan', 'Rockstar', 'Enthiran', 'Kadal', 'Slumdog Millionaire'],
    popularTracks: ['Chinna Chinna Aasai', 'Nenjame Nenjame', 'Kun Faya Kun', 'Jai Ho', 'Dil Se Re']
  },
  {
    id: 'art_ilaiyaraaja',
    canonicalName: 'Ilaiyaraaja',
    name: 'Ilaiyaraaja',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu', 'Malayalam', 'Kannada'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/aeeca2a4b9f808c8e8f5d281b1fb48d0/500x500-000000-80-0-0.jpg',
    description: 'Legendary maestro with over 7,000 orchestral compositions across South Indian cinema.',
    aliases: ['Ilayaraja', 'Illayaraja', 'Isaignani', 'Ilaya Raja', 'இளையராஜா', 'ఇళయరాజా', 'ഇളയരാജ'],
    knownFor: ['Nayagan', 'Thalapathi', 'Sindhu Bhairavi', 'Gopura Vasalile', 'Geethanjali', 'Swathi Muthyam'],
    popularTracks: ['Rakkamma Kaiya Thattu', 'Sundari Kannal Oru Sethi', 'Thendral Vanthu Theendum Bothu']
  },
  {
    id: 'art_anirudh',
    canonicalName: 'Anirudh Ravichander',
    name: 'Anirudh Ravichander',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/9da0a547b39e99bc35c6a9724aef91bf/500x500-000000-80-0-0.jpg',
    description: 'Rockstar composer creating high-energy blockbusters across Tamil, Telugu, and Hindi cinema.',
    aliases: ['Anirudh', 'Ani', 'Anirudh R', 'அனிருத்', 'अनिरुद्ध', 'అనిరుధ్'],
    knownFor: ['Leo', 'Jailer', 'Vikram', 'Master', 'Jawan', 'Devara', '3'],
    popularTracks: ['Badass', 'Hukum', 'Arabic Kuthu', 'Naa Ready', 'Chaleya', 'Why This Kolaveri Di']
  },
  {
    id: 'art_harris_jayaraj',
    canonicalName: 'Harris Jayaraj',
    name: 'Harris Jayaraj',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/b10caf45eae518a2b16997874ded7143/500x500-000000-80-0-0.jpg',
    description: 'Master of cinema acoustics, synthesizers, and timeless romantic melodies.',
    aliases: ['Harris', 'Harris Jayraj', 'HJ', 'ஹாரிஸ் ஜெயராஜ்', 'హారిస్ జయరాజ్'],
    knownFor: ['Vaaranam Aayiram', 'Minnale', 'Ghajini', 'Kaakha Kaakha', 'Anegan', 'Orange'],
    popularTracks: ['Nenjukkul Peidhidum', 'Vaseegara', 'Adiye Kolluthe', 'Mun Andhi', 'Rooba Rooba']
  },
  {
    id: 'art_yuvan_shankar_raja',
    canonicalName: 'Yuvan Shankar Raja',
    name: 'Yuvan Shankar Raja',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/b86a87799d5ca2bbdf70f1469e38f657/500x500-000000-80-0-0.jpg',
    description: 'Youth icon and pioneer of Tamil hip-hop, lo-fi, and soul-stirring background scores.',
    aliases: ['Yuvan', 'U1', 'Yuvan Shankar', 'யுவன் சங்கர் ராஜா'],
    knownFor: ['Pudhupettai', 'Paiyaa', 'Mankatha', 'Raam', 'Aadavari Matalaku Arthale Verule'],
    popularTracks: ['En Kadhal Solla', 'Oru Naalil', 'Pogadhey', 'Adada Mazhaida']
  },
  {
    id: 'art_santhosh_narayanan',
    canonicalName: 'Santhosh Narayanan',
    name: 'Santhosh Narayanan',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/574e4fe6269df701b2259160e3605c47/500x500-000000-80-0-0.jpg',
    description: 'Innovative folk, acoustic, and brass band composer with earthy signature grooves.',
    aliases: ['Santhosh', 'SaNa', 'Santhosh Narayanan SaNa', 'சந்தோஷ் நாராயணன்'],
    knownFor: ['Kabali', 'Sarpatta Parambarai', 'Kala', 'Kalki 2898 AD', 'Dasara'],
    popularTracks: ['Neruppu Da', 'Vambula Thumbula', 'Chamkeela Angeelesi', 'Ta Takkara']
  },
  {
    id: 'art_gv_prakash',
    canonicalName: 'G. V. Prakash Kumar',
    name: 'G. V. Prakash Kumar',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/686a6350fa2d0e72ae965ca4b3ee42a5/500x500-000000-80-0-0.jpg',
    description: 'Prolific national award-winning composer and singer across Tamil and Telugu cinema.',
    aliases: ['GV Prakash', 'G.V. Prakash', 'GV Prakash Kumar', 'ஜி. வி. பிரகாஷ்'],
    knownFor: ['Aadukalam', 'Soorarai Pottru', 'Asuran', 'Theri', 'Lucky Baskhar'],
    popularTracks: ['Kaattu Payale', 'Yathe Yathe', 'Eena Meena Teeka', 'Minnalai Pidithu']
  },
  {
    id: 'art_vidyasagar',
    canonicalName: 'Vidyasagar',
    name: 'Vidyasagar',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Malayalam', 'Telugu', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/f191b7e6ab232145543ef6ae321ef123/500x500-000000-80-0-0.jpg',
    description: 'Melody king celebrated for evergreen cinema duets across Tamil and Malayalam.',
    aliases: ['Vidhyasagar', 'Vidyasagar Composer', 'வித்யாசாகர்', 'വിദ്യാസാഗർ'],
    knownFor: ['Ghilli', 'Chandramukhi', 'Meesa Madhavan', 'Run', 'Dhill', 'Classmates'],
    popularTracks: ['Appadi Podu', 'Konjam Konjam', 'Enthe Innum Vanneela', 'Katte Kankadum']
  },

  // =========================================================================
  // TELUGU DIRECTORS
  // =========================================================================
  {
    id: 'art_devi_sri_prasad',
    canonicalName: 'Devi Sri Prasad',
    name: 'Devi Sri Prasad',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Telugu', 'Tamil', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/f877ca1bf69d6796324a91901a5256e2/500x500-000000-80-0-0.jpg',
    description: 'National award-winning powerhouse of mass beats and chart-topping dance anthems.',
    aliases: ['DSP', 'Devi Sri Prasad (DSP)', 'Devisriprasad', 'దేవి శ్రీ ప్రసాద్', 'தேவி ஸ்ரீ பிரசாத்'],
    knownFor: ['Pushpa: The Rise', 'Pushpa 2', 'Arya', 'Rangasthalam', 'Singam', 'Waltair Veerayya'],
    popularTracks: ['Oo Antava', 'Srivalli', 'Rangasthalam Title Track', 'Ringa Ringa', 'Seeti Maar']
  },
  {
    id: 'art_thaman_s',
    canonicalName: 'Thaman S',
    name: 'Thaman S',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Telugu', 'Tamil'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/ff708a3dcf1762a5b6d5f7f3e8201a09/500x500-000000-80-0-0.jpg',
    description: 'National award winner known for pulsating acoustic grooves and commercial blockbusters.',
    aliases: ['S. Thaman', 'Thaman', 'SS Thaman', 'థమన్'],
    knownFor: ['Ala Vaikunthapurramuloo', 'Dookudu', 'Bheemla Nayak', 'Varisu', 'Sarrainodu', 'Akhanda'],
    popularTracks: ['Samajavaragamana', 'ButtaBomma', 'Ramuloo Ramulaa', 'Ranjithame', 'Kalaavathi']
  },
  {
    id: 'art_mm_keeravani',
    canonicalName: 'M. M. Keeravani',
    name: 'M. M. Keeravani',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Telugu', 'Hindi', 'Tamil'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/e71d3c0157951a8b3e83a45c6130761e/500x500-000000-80-0-0.jpg',
    description: 'Academy Award and Golden Globe winner for Naatu Naatu; master of epic Indian cinema.',
    aliases: ['MM Keeravani', 'Keeravani', 'M. M. Kreem', 'Maragathamani', 'ఎం. ఎం. కీరవాణి', 'மரrepresented'],
    knownFor: ['RRR', 'Baahubali: The Beginning', 'Baahubali 2: The Conclusion', 'Magadheera', 'Criminal'],
    popularTracks: ['Naatu Naatu', 'Dosti', 'Saahore Baahubali', 'Tu Mile Dil Khile', 'Komuram Bheemudo']
  },

  // =========================================================================
  // HINDI DIRECTORS
  // =========================================================================
  {
    id: 'art_pritam',
    canonicalName: 'Pritam',
    name: 'Pritam',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Hindi', 'Bengali'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/90e79391ab6bfef35c342fbb1b91e57c/500x500-000000-80-0-0.jpg',
    description: 'Bollywood chartbuster titan responsible for the decade’s biggest anthems and romances.',
    aliases: ['Pritam Chakraborty', 'Pritam Da', 'प्रीतम', 'প্রীতম'],
    knownFor: ['Brahmastra', 'Yeh Jawaani Hai Deewani', 'Ae Dil Hai Mushkil', 'Jab We Met', 'Barfi!', 'Dhoom'],
    popularTracks: ['Kesariya', 'Deva Deva', 'Channa Mereya', 'Tum Hi Ho Bandhu', 'Ilahi', 'Badtameez Dil']
  },
  {
    id: 'art_vishal_shekhar',
    canonicalName: 'Vishal-Shekhar',
    name: 'Vishal-Shekhar',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Hindi', 'Marathi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/23be0b81c20fa0f56e077a79f0bb3b71/500x500-000000-80-0-0.jpg',
    description: 'Dynamic Bollywood duo blending contemporary pop, electronic dance, and soulful ballads.',
    aliases: ['Vishal and Shekhar', 'Vishal Dadlani and Shekhar Ravjiani', 'विशाल-शेखर'],
    knownFor: ['Pathaan', 'War', 'Fighter', 'Om Shanti Om', 'Student of the Year', 'Tiger Zinda Hai'],
    popularTracks: ['Besharam Rang', 'Ghungroo', 'Swag Se Swagat', 'Radha', 'Sher Khul Gaye']
  },
  {
    id: 'art_amit_trivedi',
    canonicalName: 'Amit Trivedi',
    name: 'Amit Trivedi',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Hindi', 'Gujarati'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/2cb3fa0dcab013890f5cb680c2f829ec/500x500-000000-80-0-0.jpg',
    description: 'National award-winning composer celebrated for organic folk textures and indie experimentation.',
    aliases: ['Amit Trivedi Composer', 'अमित त्रिवेदी'],
    knownFor: ['Dev.D', 'Lootera', 'Queen', 'Andhadhun', 'Kedarnath', 'Udaan'],
    popularTracks: ['Namo Namo', 'Emosanal Attyachaar', 'London Thumakda', 'Iktara', 'Qaafirana']
  },
  {
    id: 'art_mithoon',
    canonicalName: 'Mithoon',
    name: 'Mithoon',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/f95e2637f8f9e6bb07d0840b3c66f54c/500x500-000000-80-0-0.jpg',
    description: 'Master of heartbreaking soulful Hindi cinema ballads and spiritual love anthems.',
    aliases: ['Mithun Sharma', 'मिथुन'],
    knownFor: ['Aashiqui 2', 'Ek Villain', 'Sanam Re', 'Gadar 2', 'Kabir Singh'],
    popularTracks: ['Tum Hi Ho', 'Galliyan', 'Dil Sambhal Ja Zara', 'Phir Bhi Tumko Chahunga']
  },

  // =========================================================================
  // MALAYALAM DIRECTORS
  // =========================================================================
  {
    id: 'art_sushin_shyam',
    canonicalName: 'Sushin Shyam',
    name: 'Sushin Shyam',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/ee523be2eb0a66d48259441f9a1f274a/500x500-000000-80-0-0.jpg',
    description: 'Trendsetter of modern Mollywood indie electronica, folk fusion, and infectious grooves.',
    aliases: ['Sushin', 'സുഷിൻ ശ്യാം'],
    knownFor: ['Manjummel Boys', 'Aavesham', 'Kumbalangi Nights', 'Romancham', 'Minnal Murali', 'Bheeshma Parvam'],
    popularTracks: ['Illuminati', 'Kuthanthram', 'Jaada', 'Cherathukal', 'Aaditaalam Ozhinje']
  },
  {
    id: 'art_shaan_rahman',
    canonicalName: 'Shaan Rahman',
    name: 'Shaan Rahman',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/6b9c28cb94baea0cae9185a6a32cb8ad/500x500-000000-80-0-0.jpg',
    description: 'Hitmaker of viral Malayalam melodies, acoustic campus hits, and warm romantic duets.',
    aliases: ['Shaan', 'ഷാൻ റഹ്മാൻ'],
    knownFor: ['Thattathin Marayathu', 'Oru Vadakkan Selfie', 'Jacobinte Swargarajyam', 'Godha'],
    popularTracks: ['Anuraagathin Velayil', 'Manikya Malaraya Poovi', 'Neela Vaanam', 'Thiruvaavaniraavu']
  },

  // =========================================================================
  // KANNADA DIRECTORS
  // =========================================================================
  {
    id: 'art_ajaneesh_loknath',
    canonicalName: 'B. Ajaneesh Loknath',
    name: 'B. Ajaneesh Loknath',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Kannada', 'Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/33e9d892d4f24efda1cbcfdf8b0933cb/500x500-000000-80-0-0.jpg',
    description: 'Visionary composer blending folklore, indigenous chants, and progressive symphonies.',
    aliases: ['Ajaneesh Loknath', 'B Ajaneesh Loknath', 'ಅಜನೀಶ್ ಲೋಕನಾಥ್'],
    knownFor: ['Kantara', 'Kirik Party', 'Ulidavaru Kandanthe', 'Mangalavaaram', 'Avane Srimannarayana'],
    popularTracks: ['Varaha Roopam', 'Singara Siriye', 'Karma Song', 'Belageddu']
  },
  {
    id: 'art_ravi_basrur',
    canonicalName: 'Ravi Basrur',
    name: 'Ravi Basrur',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Kannada', 'Hindi', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/d1f95180f1cb2f57f5c53bfa5be1965e/500x500-000000-80-0-0.jpg',
    description: 'Architect of thunderous cinematic sound design and heavy metal orchestral scores.',
    aliases: ['Ravi Basrur Composer', 'రవి బస్రూర్', 'ರವಿ ಬಸ್ರೂರ್'],
    knownFor: ['K.G.F: Chapter 1', 'K.G.F: Chapter 2', 'Salaar: Part 1 – Ceasefire', 'Kabzaa'],
    popularTracks: ['Toofan', 'Sulthana', 'Sooraj Hi Chhaon Banke', 'Salaar Theme', 'Mehabooba']
  },

  // =========================================================================
  // MARATHI & BENGALI DIRECTORS
  // =========================================================================
  {
    id: 'art_ajay_atul',
    canonicalName: 'Ajay-Atul',
    name: 'Ajay-Atul',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Marathi', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/0b1716382103f56d9beab293ef423bc3/500x500-000000-80-0-0.jpg',
    description: 'National award-winning Marathi duo known for monumental live orchestras and raw folk energy.',
    aliases: ['Ajay and Atul', 'Ajay Gogavale and Atul Gogavale', 'अजय-अतुल'],
    knownFor: ['Sairat', 'Agneepath', 'Tanhaji', 'Natrang', 'Chikni Chameli', 'Dhadak'],
    popularTracks: ['Zingaat', 'Yad Lagla', 'Abhi Mujh Mein Kahin', 'Deva Shree Ganesha', 'Sairat Zaala Ji']
  },
  {
    id: 'art_anupam_roy',
    canonicalName: 'Anupam Roy',
    name: 'Anupam Roy',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Bengali', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/06e0e0f316e6f9d3b3ee387198ba1f70/500x500-000000-80-0-0.jpg',
    description: 'Poetic singer-songwriter and national award winner shaping modern Bengali cinema music.',
    aliases: ['Anupam', 'অনুপম রায়'],
    knownFor: ['Autograph', 'Piku', 'Hemlock Society', 'October', 'Baishe Srabon'],
    popularTracks: ['Amake Amar Moto Thakte Dao', 'Journey Song', 'Boba Tunnel', 'Tumi Jake Bhalobasho']
  },

  // =========================================================================
  // PUNJABI DIRECTORS & PRODUCERS
  // =========================================================================
  {
    id: 'art_b_praak',
    canonicalName: 'B Praak',
    name: 'B Praak',
    category: 'ARTIST',
    role: 'ALL',
    roleTitle: 'Composer & Singer',
    languages: ['Punjabi', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/95a5fbc4cefd3ba9286d52f9547cb072/500x500-000000-80-0-0.jpg',
    description: 'National award-winning singer and composer known for emotional Punjabi ballads.',
    aliases: ['BPraak', 'Pratik Bachan', 'ਬੀ ਪ੍ਰਾਕ', 'बी प्राक'],
    knownFor: ['Qismat', 'Shershaah', 'Filhall', 'Animal', 'Teri Mitti'],
    popularTracks: ['Teri Mitti', 'Mann Bharryaa', 'Filhall', 'Kaun Hoyega', 'Saari Duniya Jalaa Denge']
  },

  // =========================================================================
  // CROSS-LINGUAL PLAYBACK SINGERS
  // =========================================================================
  {
    id: 'art_sid_sriram',
    canonicalName: 'Sid Sriram',
    name: 'Sid Sriram',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/686a6350fa2d0e72ae965ca4b3ee42a5/500x500-000000-80-0-0.jpg',
    description: 'Carnatic-trained global vocalist with unmistakable soulful cinema anthems across South India.',
    aliases: [
      'Sidharth Sriram',
      'Sid Sreeram',
      'சித் ஸ்ரீராம்',
      'సిద్ శ్రీరామ్',
      'സിദ് ശ്രീറാം',
      'सिड श्रीराम'
    ],
    knownFor: ['Ala Vaikunthapurramuloo', 'Kadal', 'Pushpa: The Rise', 'Geetha Govindam', 'Enai Noki Paayum Thota'],
    popularTracks: ['Samajavaragamana', 'Srivalli', 'Adiye', 'Inkem Inkem', 'Maruvaarthai', 'Kannaana Kanne']
  },
  {
    id: 'art_spb',
    canonicalName: 'S. P. Balasubrahmanyam',
    name: 'S. P. Balasubrahmanyam',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/31ca87898d89e52c80336ae5f56993c1/500x500-000000-80-0-0.jpg',
    description: 'Guinness World Record holding legendary singer with over 40,000 recorded songs in 16 languages.',
    aliases: [
      'SPB',
      'S.P.B',
      'SP Balasubrahmanyam',
      'S. P. Balasubramanyam',
      'SP Balu',
      'எஸ். பி. பாலசுப்பிரமணியம்',
      'ఎస్. పి. బాలసుబ్రహ్మణ్యం',
      'എസ്. പി. ബാലസുബ്രഹ്മണ്യം',
      'एस. पी. बालसुब्रह्मण्यम'
    ],
    knownFor: ['Sankarabharanam', 'Roja', 'Thalapathi', 'Maine Pyar Kiya', 'Saagara Sangamam', 'Keladi Kanmani'],
    popularTracks: ['Chinna Chinna Aasai', 'Rakkamma Kaiya Thattu', 'Mere Rang Mein Rangne Wali', 'Priya Priyathama']
  },
  {
    id: 'art_ks_chithra',
    canonicalName: 'K. S. Chithra',
    name: 'K. S. Chithra',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Malayalam', 'Tamil', 'Telugu', 'Kannada', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/2301fa3b3e20e8b28f7a637b5d92e104/500x500-000000-80-0-0.jpg',
    description: 'Six-time National Award winner affectionately hailed as the Nightingale of South India.',
    aliases: ['KS Chithra', 'Chithra', 'K. S. Chitra', 'കെ. എസ്. ചിത്ര', 'கே. எஸ். சித்ரா', 'కె. ఎస్. చిత్ర'],
    knownFor: ['Roja', 'Sindhu Bhairavi', 'Nakhakshathangal', 'Geethanjali', 'Bombay', 'Virumandi'],
    popularTracks: ['Kannalane', 'Pudhu Vellai Mazhai', 'Manjal Prasadavum', 'Ovvoru Pookalume']
  },
  {
    id: 'art_shreya_ghoshal',
    canonicalName: 'Shreya Ghoshal',
    name: 'Shreya Ghoshal',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Kannada', 'Marathi', 'Punjabi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/907994bebe7a9da87e0fa0c1bf6216c5/500x500-000000-80-0-0.jpg',
    description: 'Iconic five-time National Award-winning melody queen spanning virtually every Indian language.',
    aliases: ['Shreya Ghosal', 'Shreya', 'श्रेया घोषाल', 'শ্রেয়া ঘোষাল', 'ஸ்ரேயா கோஷல்'],
    knownFor: ['Devdas', 'Jab We Met', 'Aashiqui 2', 'Jawan', 'Vinnaithaandi Varuvaayaa', 'Bajirao Mastani'],
    popularTracks: ['Tum Hi Ho', 'Chaleya', 'Deewani Mastani', 'Mannipaaya', 'Piyu Bole', 'Sunn Raha Hai']
  },
  {
    id: 'art_arijit_singh',
    canonicalName: 'Arijit Singh',
    name: 'Arijit Singh',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Bengali', 'Telugu', 'Tamil', 'Marathi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/3ba74878a2e58e3fd0cb41e975bf8741/500x500-000000-80-0-0.jpg',
    description: 'Global streaming titan and voice of contemporary Indian romance, heartbreak, and passion.',
    aliases: ['Arijit', 'Arijit Sing', 'অরিজিৎ সিং', 'अरिजीत सिंह', 'అరిజిత్ సింగ్'],
    knownFor: ['Aashiqui 2', 'Brahmastra', 'Jawan', 'Ae Dil Hai Mushkil', 'Kabir Singh', 'Dunki'],
    popularTracks: ['Kesariya', 'Tum Hi Ho', 'Chaleya', 'Channa Mereya', 'Apna Bana Le', 'Raabta']
  },
  {
    id: 'art_hariharan',
    canonicalName: 'Hariharan',
    name: 'Hariharan',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Marathi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/778e58df738b55694c9f1388b39d1b61/500x500-000000-80-0-0.jpg',
    description: 'Ghazal maestro and legendary playback singer known for timeless romantic serenades.',
    aliases: ['Hariharan Singer', 'ஹரிஹரன்', 'हरिहरन'],
    knownFor: ['Vaaranam Aayiram', 'Roja', 'Bombay', 'Indian', 'Border', 'Taal'],
    popularTracks: ['Nenjukkul Peidhidum', 'Uyire Uyire', 'Tu Hi Re', 'Chanda Re', 'Vennilave']
  },
  {
    id: 'art_kj_yesudas',
    canonicalName: 'K. J. Yesudas',
    name: 'K. J. Yesudas',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Malayalam', 'Tamil', 'Telugu', 'Kannada', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/b6f1ca0bcfdb37ca2586db39d73fc343/500x500-000000-80-0-0.jpg',
    description: 'Eight-time National Award-winning Gana Gandharvan with over 50,000 classical and cinema recordings.',
    aliases: ['KJ Yesudas', 'Yesudas', 'Kattan', 'കെ. ജെ. യേശുദാസ്', 'கே. ஜே. யேசுதாஸ்'],
    knownFor: ['His Highness Abdullah', 'Chithram', 'Thalapathi', 'Chitchor', 'Meghasandesam'],
    popularTracks: ['Pramadavanam', 'Kanne Kalaimane', 'Gori Tera Gaon Bada Pyara', 'Harivarasanam']
  },
  {
    id: 'art_vijay_yesudas',
    canonicalName: 'Vijay Yesudas',
    name: 'Vijay Yesudas',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Malayalam', 'Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/9c1dfecb7ab4cbbd25ae9e2b10ab498f/500x500-000000-80-0-0.jpg',
    description: 'Celebrated voice of evergreen modern Mollywood and Kollywood cinema melodies.',
    aliases: ['Vijay Yesudas Singer', 'വിജയ് യേശുദാസ്', 'விஜய் யேசுதாஸ்'],
    knownFor: ['Premam', 'Maari', 'Avan Chandiyude Makan', 'Ennu Ninte Moideen'],
    popularTracks: ['Malare', 'Senjitaley', 'Mazhaye Mazhaye', 'Ekantham']
  },
  {
    id: 'art_haricharan',
    canonicalName: 'Haricharan',
    name: 'Haricharan',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/23be0b81c20fa0f56e077a79f0bb3b71/500x500-000000-80-0-0.jpg',
    description: 'Carnatic-rooted playback singer known for complex melodic nuances and vocal agility.',
    aliases: ['Haricharan Seshadri', 'ஹரிசரண்'],
    knownFor: ['Bangalore Days', 'Kaaviya Thalaivan', 'Paiyaa', 'Baahubali', 'Kantara'],
    popularTracks: ['Thuli Thuli', 'Vaathi Coming', 'Ethu Kari Raavilum', 'Singara Siriye']
  },
  {
    id: 'art_armaan_malik',
    canonicalName: 'Armaan Malik',
    name: 'Armaan Malik',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Telugu', 'Tamil', 'Kannada', 'English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/c6655c6ba4d78ba83e589c3bc8be263b/500x500-000000-80-0-0.jpg',
    description: 'Multilingual romantic balladeer and international MTV EMA award-winning pop sensation.',
    aliases: ['Armaan', 'अरमान मलिक', 'అర్మాన్ మాలిక్'],
    knownFor: ['Ala Vaikunthapurramuloo', 'M.S. Dhoni: The Untold Story', 'Hero', 'Kabir Singh'],
    popularTracks: ['ButtaBomma', 'Bol Do Na Zara', 'Main Hoon Hero Tera', 'Jab Tak']
  },
  {
    id: 'art_chinmayi',
    canonicalName: 'Chinmayi Sripaada',
    name: 'Chinmayi Sripaada',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Hindi', 'Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/d1f95180f1cb2f57f5c53bfa5be1965e/500x500-000000-80-0-0.jpg',
    description: 'National award-winning singer and voice artist celebrated for emotive vocal delivery.',
    aliases: ['Chinmayi', 'Chinmayee', 'சின்மயி', 'చిన్మయి'],
    knownFor: ['Kannathil Muthamittal', '96', 'Guru', 'Chennai Express', 'Majili'],
    popularTracks: ['Oru Deivam Thandha Poove', 'Kaathalae Kaathalae', 'Titli', 'Priyamani']
  },
  {
    id: 'art_anurag_kulkarni',
    canonicalName: 'Anurag Kulkarni',
    name: 'Anurag Kulkarni',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/1947b748729fb5917f6920d0496ffbe7/500x500-000000-80-0-0.jpg',
    description: 'Leading Telugu playback vocalist behind numerous viral chartbusters and acoustic hits.',
    aliases: ['Anurag', 'అనురాగ్ కులకర్ణి'],
    knownFor: ['RX 100', 'Ala Vaikunthapurramuloo', 'Sita Ramam', 'iSmart Shankar'],
    popularTracks: ['Pilla Raa', 'Ramuloo Ramulaa', 'Inthandham', 'Dimaak Kharaab']
  },
  {
    id: 'art_sonu_nigam',
    canonicalName: 'Sonu Nigam',
    name: 'Sonu Nigam',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Kannada', 'Bengali', 'Marathi', 'Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/7ea06b29d49488e04044810f69d762e1/500x500-000000-80-0-0.jpg',
    description: 'Padma Shri and National Award-winning vocal virtuoso celebrated as the Modern Rafi.',
    aliases: ['Sonu', 'Sonu Niigaam', 'सोनू निगम', 'ಸೋನು ನಿಗಮ್'],
    knownFor: ['Kal Ho Naa Ho', 'Mungaru Male', 'Agneepath', 'Main Hoon Na', 'Border', 'Kabhi Khushi Kabhie Gham'],
    popularTracks: ['Kal Ho Naa Ho', 'Abhi Mujh Mein Kahin', 'Anisuthide', 'Suraj Hua Maddham']
  },
  {
    id: 'art_sunidhi_chauhan',
    canonicalName: 'Sunidhi Chauhan',
    name: 'Sunidhi Chauhan',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Telugu', 'Tamil', 'Marathi', 'Punjabi', 'Kannada'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/574e4fe6269df701b2259160e3605c47/500x500-000000-80-0-0.jpg',
    description: 'Powerhouse vocalist and live performer delivering high-octane dance numbers and soulful ballads.',
    aliases: ['Sunidhi', 'सुनिधि चौहान'],
    knownFor: ['Dhoom', 'Sheila Ki Jawani', 'Kamli', 'Beedi', 'Te Amo'],
    popularTracks: ['Dhoom Machale', 'Sheila Ki Jawani', 'Kamli', 'Crazy Kiya Re', 'Dance Pe Chance']
  },
  {
    id: 'art_diljit_dosanjh',
    canonicalName: 'Diljit Dosanjh',
    name: 'Diljit Dosanjh',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Punjabi', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/bb4109b828efebae13e9a7e31b6e492c/500x500-000000-80-0-0.jpg',
    description: 'Global Punjabi music and cinema icon headlining stadiums and international festivals.',
    aliases: ['Diljit', 'Dosanjh', 'ਦਿਲਜੀਤ ਦੋਸਾਂਝ', 'दिलजीत दोसांझ'],
    knownFor: ['G.O.A.T.', 'MoonChild Era', 'Lover', 'Amar Singh Chamkila', 'Udta Punjab'],
    popularTracks: ['Lover', 'G.O.A.T.', 'Do You Know', 'Born to Shine', 'Naina']
  },
  {
    id: 'art_ap_dhillon',
    canonicalName: 'AP Dhillon',
    name: 'AP Dhillon',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer & Songwriter',
    languages: ['Punjabi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/6dc886d34b277d704ec3ad0b0cfa0fcb/500x500-000000-80-0-0.jpg',
    description: 'Pioneer of contemporary Punjabi trap, synth-pop, and atmospheric R&B.',
    aliases: ['Amritpal Singh Dhillon', 'ਏ ਪੀ ਢਿੱਲੋਂ'],
    knownFor: ['Brown Munde', 'Insane', 'Excuses', 'Hidden Gems'],
    popularTracks: ['Brown Munde', 'Excuses', 'Insane', 'With You']
  },
  {
    id: 'art_vijay_prakash',
    canonicalName: 'Vijay Prakash',
    name: 'Vijay Prakash',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Kannada', 'Tamil', 'Telugu', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/33e9d892d4f24efda1cbcfdf8b0933cb/500x500-000000-80-0-0.jpg',
    description: 'Grammy-winning vocalist for Jai Ho and leading playback voice across Karnataka and Tamil Nadu.',
    aliases: ['Vijay Prakash Singer', 'ವಿಜಯ್ ಪ್ರಕಾಶ್', 'விஜய் பிரகாஷ்'],
    knownFor: ['Slumdog Millionaire', 'Kantara', 'Vinnaithaandi Varuvaayaa', 'Kirik Party'],
    popularTracks: ['Jai Ho', 'Varaha Roopam', 'Hosanna', 'Belageddu']
  },
  {
    id: 'art_the_weeknd',
    canonicalName: 'The Weeknd',
    name: 'The Weeknd',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer & Producer',
    languages: ['English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/7f3a8b4189e47228c2e6bb60f0f42337/500x500-000000-80-0-0.jpg',
    description: 'Global pop and dark R&B pioneer with multiple Diamond-certified records.',
    aliases: ['Abel Tesfaye', 'Abel Makkonen Tesfaye', 'Weeknd'],
    knownFor: ['After Hours', 'Starboy', 'Beauty Behind the Madness', 'Dawn FM'],
    popularTracks: ['Blinding Lights', 'Starboy', 'Save Your Tears', 'The Hills']
  },
  {
    id: 'art_taylor_swift',
    canonicalName: 'Taylor Swift',
    name: 'Taylor Swift',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer-Songwriter',
    languages: ['English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/50b86a87799d5ca2bbdf70f1469e38f6/500x500-000000-80-0-0.jpg',
    description: 'Global cultural phenomenon and four-time Album of the Year Grammy winner.',
    aliases: ['Taylor', 'TSwift', 'Taylor Alison Swift'],
    knownFor: ['1989', 'Folklore', 'Midnights', 'The Tortured Poets Department', 'Red'],
    popularTracks: ['Anti-Hero', 'Cruel Summer', 'Blank Space', 'Cardigan']
  },
  {
    id: 'art_ed_sheeran',
    canonicalName: 'Ed Sheeran',
    name: 'Ed Sheeran',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer-Songwriter',
    languages: ['English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/99e9009ec845a7bb91e3e8f81fb07b68/500x500-000000-80-0-0.jpg',
    description: 'Global record-shattering acoustic pop icon and multi-Grammy winner.',
    aliases: ['Edward Christopher Sheeran', 'Teddy'],
    knownFor: ['Divide', 'Multiply', 'Equals', 'Subtract'],
    popularTracks: ['Shape of You', 'Perfect', 'Bad Habits', 'Photograph']
  }
];

export class CanonicalArtistService {
  private static canonicalArtistsMap = new Map<string, CanonicalArtist>();
  private static aliasToIdMap = new Map<string, string>();
  private static queryCache = new Map<string, PaginatedArtistsResponse>();

  static {
    this.initializeMasterCatalogue();
  }

  /**
   * Initializes or re-seeds the canonical catalogue and builds index maps
   */
  public static initializeMasterCatalogue(): void {
    this.canonicalArtistsMap.clear();
    this.aliasToIdMap.clear();
    this.queryCache.clear();

    for (const artist of INITIAL_CANONICAL_ARTISTS) {
      this.registerOrMergeArtist(artist);
    }
  }

  /**
   * Registers a new canonical artist or merges into an existing one if a duplicate is detected.
   * Duplicate detection criteria:
   * 1. Exact canonical ID
   * 2. Normalized canonical name
   * 3. Normalized alias match
   */
  public static registerOrMergeArtist(candidate: {
    id?: string;
    canonicalName: string;
    role?: 'DIRECTOR' | 'SINGER' | 'ALL';
    roleTitle?: string;
    languages?: string[];
    imageUrl?: string;
    description?: string;
    aliases?: string[];
    knownFor?: string[];
    popularTracks?: string[];
  }): CanonicalArtist {
    const normName = normalizeArtistName(candidate.canonicalName);

    // 1. Check if an existing artist matches by ID
    let existing: CanonicalArtist | undefined;
    if (candidate.id && this.canonicalArtistsMap.has(candidate.id)) {
      existing = this.canonicalArtistsMap.get(candidate.id);
    }

    // 2. Check if normalized name points to an existing alias or canonical name
    if (!existing) {
      const matchedId = this.aliasToIdMap.get(normName);
      if (matchedId) {
        existing = this.canonicalArtistsMap.get(matchedId);
      }
    }

    // 3. Check if any of the candidate's aliases match an existing artist
    if (!existing && candidate.aliases) {
      for (const alias of candidate.aliases) {
        const normAlias = normalizeArtistName(alias);
        const matchedId = this.aliasToIdMap.get(normAlias);
        if (matchedId) {
          existing = this.canonicalArtistsMap.get(matchedId);
          break;
        }
      }
    }

    if (existing) {
      // Merge unique languages
      const mergedLangs = new Set([
        ...existing.languages,
        ...(candidate.languages || [])
      ]);
      existing.languages = Array.from(mergedLangs);

      // Merge unique aliases
      const mergedAliases = new Set([
        ...existing.aliases,
        candidate.canonicalName,
        ...(candidate.aliases || [])
      ]);
      existing.aliases = Array.from(mergedAliases);

      // Merge knownFor
      const mergedKnown = new Set([
        ...existing.knownFor,
        ...(candidate.knownFor || [])
      ]);
      existing.knownFor = Array.from(mergedKnown);

      // Merge popularTracks
      const mergedTracks = new Set([
        ...existing.popularTracks,
        ...(candidate.popularTracks || [])
      ]);
      existing.popularTracks = Array.from(mergedTracks);

      if (candidate.imageUrl && !existing.imageUrl) {
        existing.imageUrl = candidate.imageUrl;
      }
      if (candidate.description && !existing.description) {
        existing.description = candidate.description;
      }

      // Re-index all aliases for this artist
      this.indexArtistAliases(existing);
      this.queryCache.clear();
      return existing;
    }

    // Otherwise, create a new canonical record
    const id = candidate.id || `art_${normName.replace(/[^a-z0-9]/g, '_')}`;
    const newArtist: CanonicalArtist = {
      id,
      canonicalName: candidate.canonicalName,
      name: candidate.canonicalName,
      category: 'ARTIST',
      role: candidate.role || 'SINGER',
      roleTitle: candidate.roleTitle || (candidate.role === 'DIRECTOR' ? 'Music Director' : 'Playback Singer'),
      languages: Array.from(new Set(candidate.languages || ['Tamil'])),
      imageUrl: candidate.imageUrl || 'https://cdn-images.dzcdn.net/images/artist/bd34315ef977a62a9e28c1ab19bb8ac4/500x500-000000-80-0-0.jpg',
      description: candidate.description || '',
      aliases: Array.from(new Set([candidate.canonicalName, ...(candidate.aliases || [])])),
      knownFor: Array.from(new Set(candidate.knownFor || [])),
      popularTracks: Array.from(new Set(candidate.popularTracks || [])),
      createdAt: new Date().toISOString()
    };

    this.canonicalArtistsMap.set(id, newArtist);
    this.indexArtistAliases(newArtist);
    this.queryCache.clear();
    return newArtist;
  }

  private static indexArtistAliases(artist: CanonicalArtist): void {
    const normCanonical = normalizeArtistName(artist.canonicalName);
    this.aliasToIdMap.set(normCanonical, artist.id);

    for (const alias of artist.aliases) {
      const normAlias = normalizeArtistName(alias);
      if (normAlias) {
        this.aliasToIdMap.set(normAlias, artist.id);
      }
    }
  }

  /**
   * Resolves any name, alias, or ID to a single canonical artist record.
   */
  public static findCanonicalArtist(query: string): CanonicalArtist | undefined {
    if (!query) return undefined;
    const cleanId = query.trim();
    if (this.canonicalArtistsMap.has(cleanId)) {
      return this.canonicalArtistsMap.get(cleanId);
    }

    const norm = normalizeArtistName(query);
    const resolvedId = this.aliasToIdMap.get(norm);
    if (resolvedId && this.canonicalArtistsMap.has(resolvedId)) {
      return this.canonicalArtistsMap.get(resolvedId);
    }

    // Fallback: check if query is contained in canonical name or aliases
    for (const artist of this.canonicalArtistsMap.values()) {
      if (
        normalizeArtistName(artist.canonicalName).includes(norm) ||
        artist.aliases.some((a) => normalizeArtistName(a).includes(norm))
      ) {
        return artist;
      }
    }

    return undefined;
  }

  /**
   * Main query method supporting:
   * - Strict language filtering (multi-language support)
   * - Duplicate removal (each artist returned at most once)
   * - Role filtering ('DIRECTOR' | 'SINGER' | 'ALL')
   * - Search across names, aliases, regional scripts, movies & tracks
   * - Server-side pagination
   * - In-memory caching
   */
  public static getArtists(options?: {
    languages?: string[];
    role?: 'DIRECTOR' | 'SINGER' | 'ALL';
    query?: string;
    page?: number;
    limit?: number;
    includeAllLanguages?: boolean;
  }): PaginatedArtistsResponse {
    const page = Math.max(1, options?.page || 1);
    const limit = options?.limit !== undefined ? Math.max(1, Math.min(options.limit, 200)) : 50;
    const role = options?.role || 'ALL';
    const rawQuery = (options?.query || '').trim();
    const includeAll = Boolean(options?.includeAllLanguages);

    const activeLangs = (options?.languages || [])
      .map((l) => l.trim())
      .filter(Boolean);

    // Build Cache Key
    const langKey = includeAll ? 'ALL' : activeLangs.slice().sort().map((l) => l.toLowerCase()).join(',');
    const cacheKey = `${langKey}|${role}|${rawQuery.toLowerCase()}|${page}|${limit}`;

    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }

    let allArtists = Array.from(this.canonicalArtistsMap.values());

    // 1. Role Filter
    if (role !== 'ALL') {
      allArtists = allArtists.filter((a) => a.role === role || a.role === 'ALL');
    }

    // 2. Strict Language Filter
    // If languages are selected and includeAll is false, only keep artists associated with at least one selected language
    if (!includeAll && activeLangs.length > 0) {
      const langSet = new Set(activeLangs.map((l) => l.toLowerCase()));
      allArtists = allArtists.filter((a) =>
        a.languages.some((artistLang) => langSet.has(artistLang.toLowerCase()))
      );
    }

    // 3. Search Filter (Canonical name, Aliases, RoleTitle, Movies, Popular tracks, Languages)
    if (rawQuery) {
      const qNorm = normalizeArtistName(rawQuery);
      allArtists = allArtists.filter((a) => {
        // Direct canonical name match
        if (normalizeArtistName(a.canonicalName).includes(qNorm)) return true;
        // Aliases & native scripts match
        if (a.aliases.some((al) => normalizeArtistName(al).includes(qNorm) || al.toLowerCase().includes(rawQuery.toLowerCase()))) return true;
        // Role title match
        if (a.roleTitle.toLowerCase().includes(rawQuery.toLowerCase())) return true;
        // Known for / Movies match
        if (a.knownFor.some((k) => k.toLowerCase().includes(rawQuery.toLowerCase()))) return true;
        // Popular tracks match
        if (a.popularTracks.some((t) => t.toLowerCase().includes(rawQuery.toLowerCase()))) return true;
        // Languages match
        if (a.languages.some((l) => l.toLowerCase().includes(rawQuery.toLowerCase()))) return true;
        return false;
      });
    }

    // 4. Strict Deduplication Guarantee:
    // Ensure every artist in the final list has a unique canonical ID and unique normalized name
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const deduplicated: CanonicalArtist[] = [];

    for (const artist of allArtists) {
      const norm = normalizeArtistName(artist.canonicalName);
      if (!seenIds.has(artist.id) && !seenNames.has(norm)) {
        seenIds.add(artist.id);
        seenNames.add(norm);
        deduplicated.push(artist);
      }
    }

    // 5. Pagination
    const total = deduplicated.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = deduplicated.slice(startIndex, startIndex + limit);

    const response: PaginatedArtistsResponse = {
      artists: paginated,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      selectedLanguages: activeLangs
    };

    // Cache the response
    this.queryCache.set(cacheKey, response);
    return response;
  }

  /**
   * Helper that deduplicates any arbitrary list of ArtistItem objects by canonical identification.
   */
  public static deduplicateArtistItems(items: ArtistItem[]): ArtistItem[] {
    const seenIds = new Set<string>();
    const seenCanonicalNames = new Set<string>();
    const uniqueList: ArtistItem[] = [];

    for (const item of items) {
      const canonical = this.findCanonicalArtist(item.name) || this.findCanonicalArtist(item.id);
      const canonicalId = canonical ? canonical.id : item.id;
      const canonicalName = canonical ? normalizeArtistName(canonical.canonicalName) : normalizeArtistName(item.name);

      if (!seenIds.has(canonicalId) && !seenCanonicalNames.has(canonicalName)) {
        seenIds.add(canonicalId);
        seenCanonicalNames.add(canonicalName);

        // Enrich with canonical multilingual languages if available
        const enrichedLanguages = canonical
          ? Array.from(new Set([...item.languages, ...canonical.languages]))
          : item.languages;

        uniqueList.push({
          ...item,
          id: canonicalId,
          name: canonical ? canonical.canonicalName : item.name,
          languages: enrichedLanguages
        });
      }
    }

    return uniqueList;
  }
}

import { CanonicalArtistService } from './canonicalArtist.service';

export interface ArtistItem {
  id: string;
  name: string;
  canonicalName?: string;
  category: 'ARTIST';
  role: 'DIRECTOR' | 'SINGER' | 'ALL';
  roleTitle: string;
  languages: string[];
  imageUrl: string;
  knownFor: string[];
  popularTracks: string[];
  aliases?: string[];
  description?: string;
}

export const ARTISTS_CATALOG: ArtistItem[] = [
  // ===================== MUSIC DIRECTORS =====================
  // Tamil
  {
    id: 'dir_ar_rahman',
    name: 'A. R. Rahman',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Hindi', 'Telugu', 'English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/bd34315ef977a62a9e28c1ab19bb8ac4/500x500-000000-80-0-0.jpg',
    knownFor: ['Roja', 'Dil Se', 'Ponniyin Selvan', 'Rockstar', 'Enthiran'],
    popularTracks: ['Chinna Chinna Aasai', 'Nenjame Nenjame', 'Kun Faya Kun', 'Jai Ho']
  },
  {
    id: 'dir_ilaiyaraaja',
    name: 'Ilaiyaraaja',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu', 'Malayalam', 'Kannada'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/aeeca2a4b9f808c8e8f5d281b1fb48d0/500x500-000000-80-0-0.jpg',
    knownFor: ['Nayagan', 'Thalapathi', 'Sindhu Bhairavi', 'Gopura Vasalile'],
    popularTracks: ['Rakkamma Kaiya Thattu', 'Sundari Kannal Oru Sethi', 'Thendral Vanthu Theendum Bothu']
  },
  {
    id: 'dir_anirudh',
    name: 'Anirudh Ravichander',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/9da0a547b39e99bc35c6a9724aef91bf/500x500-000000-80-0-0.jpg',
    knownFor: ['Leo', 'Jailer', 'Vikram', 'Master', 'Jawan', 'Devara'],
    popularTracks: ['Badass', 'Hukum', 'Arabic Kuthu', 'Naa Ready', 'Chaleya']
  },
  {
    id: 'dir_harris_jayaraj',
    name: 'Harris Jayaraj',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/b10caf45eae518a2b16997874ded7143/500x500-000000-80-0-0.jpg',
    knownFor: ['Vaaranam Aayiram', 'Minnale', 'Ghajini', 'Kaakha Kaakha', 'Anegan'],
    popularTracks: ['Nenjukkul Peidhidum', 'Vaseegara', 'Adiye Kolluthe', 'Mun Andhi']
  },
  {
    id: 'dir_yuvan',
    name: 'Yuvan Shankar Raja',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/1dbf7d81a2e964d9c707e53478407974/500x500-000000-80-0-0.jpg',
    knownFor: ['Pudhupettai', 'Mankatha', '7G Rainbow Colony', 'Raam', 'Maanaadu'],
    popularTracks: ['Idhu Varai', 'Oru Naalil', 'Kaadhal Kondein', 'Voice of Biriyani']
  },
  {
    id: 'dir_gv_prakash',
    name: 'G. V. Prakash Kumar',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director & Singer',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/e9c4be67e7e086a81cb8ab3d0160d45a/500x500-000000-80-0-0.jpg',
    knownFor: ['Aayirathil Oruvan', 'Soorarai Pottru', 'Asuran', 'Theri', 'Captain Miller'],
    popularTracks: ['Veyyon Silli', 'Katthi Theme', 'Yathe Yathe', 'Kaattu Payale']
  },
  {
    id: 'dir_santhosh_narayanan',
    name: 'Santhosh Narayanan',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/74004fed94dddf9ae2d7c83084eaf1ad/500x500-000000-80-0-0.jpg',
    knownFor: ['Kabali', 'Kaala', 'Kalki 2898 AD', 'Sarpatta Parambarai', 'Jigarthanda'],
    popularTracks: ['Neruppu Da', 'Neeye Oli', 'Ta Takkara', 'Bhairava Anthem']
  },

  // Telugu
  {
    id: 'dir_dsp',
    name: 'Devi Sri Prasad (DSP)',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Telugu', 'Tamil', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/a904f8ee6cc4dcb472f75bd8ae1a21da/500x500-000000-80-0-0.jpg',
    knownFor: ['Pushpa: The Rise', 'Pushpa 2', 'Arya', 'Rangasthalam', 'Waltair Veerayya'],
    popularTracks: ['Oo Antava Oo Oo Antava', 'Srivalli', 'Saami Saami', 'Ringa Ringa']
  },
  {
    id: 'dir_thaman',
    name: 'S. Thaman',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Telugu', 'Tamil'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/910c0078f7867daaade0fa2d94e37e1b/500x500-000000-80-0-0.jpg',
    knownFor: ['Ala Vaikunthapurramuloo', 'Guntur Kaaram', 'Sarrainodu', 'Akhanda'],
    popularTracks: ['Butta Bomma', 'Samajavaragamana', 'Kurchi Madathapetti', 'Ramuloo Ramulaa']
  },
  {
    id: 'dir_keeravani',
    name: 'M. M. Keeravani',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Telugu', 'Tamil', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/5d78a2351117fed4d9d9c564de968a7e/500x500-000000-80-0-0.jpg',
    knownFor: ['RRR', 'Baahubali: The Beginning', 'Baahubali 2', 'Magadheera'],
    popularTracks: ['Naatu Naatu', 'Dosti', 'Saahore Baahubali', 'Komuram Bheemudo']
  },

  // Malayalam
  {
    id: 'dir_sushin_shyam',
    name: 'Sushin Shyam',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Malayalam', 'Tamil'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/6ba914ca28d2c5cc21dc3effa07c690d/500x500-000000-80-0-0.jpg',
    knownFor: ['Manjummel Boys', 'Aavesham', 'Kumbalangi Nights', 'Romancham', 'Bheeshma Parvam'],
    popularTracks: ['Illuminati', 'Kuthanthram', 'Jaada', 'Cherathukal', 'Parudeesa']
  },
  {
    id: 'dir_shaan_rahman',
    name: 'Shaan Rahman',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Malayalam', 'Kannada'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/8b9a3cfa3498e339778f6c1dde87a360/500x500-000000-80-0-0.jpg',
    knownFor: ['Thattathin Marayathu', 'Oru Adaar Love', 'Jacobinte Swargarajyam'],
    popularTracks: ['Manikya Malaraya Poovi', 'Muthuchippi', 'Anuragathin Velayil']
  },

  // Kannada
  {
    id: 'dir_ravi_basrur',
    name: 'Ravi Basrur',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Kannada', 'Telugu', 'Tamil', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/8cd91105aa78393cbddd3e7215e2eb55/500x500-000000-80-0-0.jpg',
    knownFor: ['K.G.F: Chapter 1', 'K.G.F: Chapter 2', 'Salaar: Part 1', 'Kabzaa'],
    popularTracks: ['Toofan', 'Sulthan', 'Dheera Dheera', 'Sooreede']
  },
  {
    id: 'dir_ajaneesh',
    name: 'B. Ajaneesh Loknath',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Kannada', 'Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/a3319b808420e0f22cbf857a17e4b8f1/500x500-000000-80-0-0.jpg',
    knownFor: ['Kantara', 'Vikrant Rona', 'Kirik Party', 'Mangalavaaram'],
    popularTracks: ['Varaha Roopam', 'Singara Siriye', 'Belageddu', 'Ra Ra Rakkamma']
  },

  // Hindi
  {
    id: 'dir_pritam',
    name: 'Pritam',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Hindi', 'Bengali'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/d4914ccd414067cd5e2c108867079a85/500x500-000000-80-0-0.jpg',
    knownFor: ['Brahmastra', 'Yeh Jawaani Hai Deewani', 'Ae Dil Hai Mushkil', 'Barfi!', 'Jab We Met'],
    popularTracks: ['Kesariya', 'Tum Se Hi', 'Channa Mereya', 'Balam Pichkari']
  },
  {
    id: 'dir_vishal_shekhar',
    name: 'Vishal-Shekhar',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Hindi', 'Marathi', 'English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/5871137ebfd9723ea757b8380fe404c5/500x500-000000-80-0-0.jpg',
    knownFor: ['Pathaan', 'War', 'Fighter', 'Om Shanti Om', 'Student of the Year'],
    popularTracks: ['Besharam Rang', 'Sher Khul Gaye', 'Ghungroo', 'Radha']
  },
  {
    id: 'dir_amit_trivedi',
    name: 'Amit Trivedi',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Music Director',
    languages: ['Hindi', 'Gujarati', 'Marathi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/c3b5e31a6f9da09ecfab77e2b3d9f3eb/500x500-000000-80-0-0.jpg',
    knownFor: ['Dev.D', 'Queen', 'Lootera', 'Kedarnath', 'Andhadhun'],
    popularTracks: ['Namo Namo', 'London Thumakda', 'Iktara', 'Emosanal Attyachaar']
  },

  // English / Global
  {
    id: 'dir_hans_zimmer',
    name: 'Hans Zimmer',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Film Composer',
    languages: ['English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/1bd0b9f7a3cf12e01bdcc26fa69673f7/500x500-000000-80-0-0.jpg',
    knownFor: ['Interstellar', 'Inception', 'Dune', 'Gladiator', 'The Dark Knight'],
    popularTracks: ['Time', 'Cornfield Chase', 'Now We Are Free', 'Stay']
  },
  {
    id: 'dir_metro_boomin',
    name: 'Metro Boomin',
    category: 'ARTIST',
    role: 'DIRECTOR',
    roleTitle: 'Producer & Composer',
    languages: ['English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/bc031b73f958987fa103031070be5c16/500x500-000000-80-0-0.jpg',
    knownFor: ['Spider-Man: Across the Spider-Verse', 'Heroes & Villains', 'Savage Mode II'],
    popularTracks: ['Am I Dreaming', 'Creepin\'', 'Annihilate', 'Superhero']
  },

  // ===================== SINGERS =====================
  // South Indian Legends & Melodies
  {
    id: 'sin_spb',
    name: 'S. P. Balasubrahmanyam',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/d892204d2b88ad355fb022e09dd6c134/500x500-000000-80-0-0.jpg',
    knownFor: ['Sankarabharanam', 'Mouna Ragam', 'Keladi Kanmani', 'Maine Pyar Kiya'],
    popularTracks: ['En Kadhale', 'Mannil Indha Kaadhalandri', 'Sundari Kannal', 'Tere Mere Beech Mein']
  },
  {
    id: 'sin_chithra',
    name: 'K. S. Chithra',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Malayalam', 'Telugu', 'Kannada', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/b955b3207b61e722cf4d63ee0c762b12/500x500-000000-80-0-0.jpg',
    knownFor: ['Sindhu Bhairavi', 'Roja', 'Kandukondain Kandukondain', 'Autograph'],
    popularTracks: ['Kannalane', 'Ovvoru Pookalume', 'En Vaanile', 'Kalyana Thetheni']
  },
  {
    id: 'sin_sid_sriram',
    name: 'Sid Sriram',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Malayalam', 'Kannada', 'English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/fbe3e1d17fc6958e047f011f74233f82/500x500-000000-80-0-0.jpg',
    knownFor: ['Kadal', 'Geetha Govindam', 'Pushpa: The Rise', 'Ala Vaikunthapurramuloo'],
    popularTracks: ['Adiye', 'Inkem Inkem', 'Srivalli', 'Samajavaragamana', 'Kannaana Kanney']
  },
  {
    id: 'sin_shreya_ghoshal',
    name: 'Shreya Ghoshal',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Tamil', 'Telugu', 'Bengali', 'Malayalam', 'Kannada'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/3bb832d37d10ff2affcfa9afdc7c68a0/500x500-000000-80-0-0.jpg',
    knownFor: ['Devdas', 'Jab We Met', 'I', 'Bajirao Mastani', 'Animal'],
    popularTracks: ['Deewani Mastani', 'Munbe Vaa', 'Pee Loon', 'Teri Ore', 'Angaaron']
  },
  {
    id: 'sin_hariharan',
    name: 'Hariharan',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Hindi', 'Telugu', 'Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/ead44b7f4f45556dc37b026b18040ece/500x500-000000-80-0-0.jpg',
    knownFor: ['Roja', 'Rangeela', 'Taal', 'Mudhalvan'],
    popularTracks: ['Vennilave Vennilave', 'Uyire Uyire', 'Tu Hi Re', 'Kurukku Chiruthavale']
  },
  {
    id: 'sin_chinmayi',
    name: 'Chinmayi Sripaada',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Hindi', 'Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/2348c0926bfb8e5ae536c7354658ac50/500x500-000000-80-0-0.jpg',
    knownFor: ['Kannathil Muthamittal', 'Guru', '96', 'Chennai Express'],
    popularTracks: ['Oru Dheivam Thandha Poove', 'Kaathalae Kaathalae', 'Titli', 'Tere Bina']
  },
  {
    id: 'sin_pradeep_kumar',
    name: 'Pradeep Kumar',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer & Composer',
    languages: ['Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/87c0266a02406bc9c500bd3620d1d52b/500x500-000000-80-0-0.jpg',
    knownFor: ['Madras', 'Kabali', 'Sarpatta Parambarai', 'Kavalthurai Ungal Nanban'],
    popularTracks: ['Aagayam Theepiditha', 'Maya Nadhi', 'Neeye Oli', 'Po Urave']
  },
  {
    id: 'sin_jonita_gandhi',
    name: 'Jonita Gandhi',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Hindi', 'Telugu', 'English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/f756c825ab0eb367cd85f077c28d0719/500x500-000000-80-0-0.jpg',
    knownFor: ['Doctor', 'Beast', 'Dangal', 'Brahmastra'],
    popularTracks: ['Chellama', 'Arabic Kuthu', 'Gilehriyaan', 'Deva Deva']
  },
  {
    id: 'sin_haricharan',
    name: 'Haricharan',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Tamil', 'Telugu', 'Malayalam'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/923607e2ef5b425a8c6203f7439ad44f/500x500-000000-80-0-0.jpg',
    knownFor: ['Kaadhal', 'Bangalore Days', 'Baahubali: The Beginning', 'Ponniyin Selvan'],
    popularTracks: ['Unakkenna Venum Sollu', 'Aalaporan Thamizhan', 'Thuli Thuli']
  },
  {
    id: 'sin_vijay_yesudas',
    name: 'Vijay Yesudas',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Malayalam', 'Tamil', 'Telugu', 'Kannada'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/b1f8fbe72c99d309616ae5b7da1c4974/500x500-000000-80-0-0.jpg',
    knownFor: ['Premam', 'Dhanush / Maari', 'Kolamaavu Kokila'],
    popularTracks: ['Malare', 'Avastha', 'Avalum Naanum']
  },

  // Hindi & Northern Stars
  {
    id: 'sin_arijit_singh',
    name: 'Arijit Singh',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Bengali', 'Telugu', 'Tamil'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/ac5350cff290edd5b69fa584b8b1bd4f/500x500-000000-80-0-0.jpg',
    knownFor: ['Aashiqui 2', 'Brahmastra', 'Kabir Singh', 'Dunki', 'Jawan'],
    popularTracks: ['Tum Hi Ho', 'Kesariya', 'Channa Mereya', 'Chaleya', 'Agar Tum Saath Ho']
  },
  {
    id: 'sin_atif_aslam',
    name: 'Atif Aslam',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Punjabi', 'Urdu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/0ea90444148fff9c11d77f06a344724e/500x500-000000-80-0-0.jpg',
    knownFor: ['Race', 'Ajab Prem Ki Ghazab Kahani', 'Tiger Zinda Hai', 'Badlapur'],
    popularTracks: ['Tera Hone Laga Hoon', 'Dil Diyan Gallan', 'Jeena Jeena', 'Pehli Nazar Mein']
  },
  {
    id: 'sin_sonu_nigam',
    name: 'Sonu Nigam',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Kannada', 'Bengali', 'Tamil', 'Telugu'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/812220125c4f0db57050438b65afcf78/500x500-000000-80-0-0.jpg',
    knownFor: ['Kal Ho Naa Ho', 'Mungaru Male', 'Main Hoon Na', 'Laal Singh Chaddha'],
    popularTracks: ['Kal Ho Naa Ho', 'Anisuthide', 'Abhi Mujh Mein Kahin', 'Suraj Hua Maddham']
  },
  {
    id: 'sin_sunidhi_chauhan',
    name: 'Sunidhi Chauhan',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Playback Singer',
    languages: ['Hindi', 'Tamil', 'Telugu', 'Punjabi', 'Bengali'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/37dbd33ae8cf7075e247968acf4b48da/500x500-000000-80-0-0.jpg',
    knownFor: ['Dhoom', 'Sheila Ki Jawani', 'Pushpa 2', 'The Dirty Picture'],
    popularTracks: ['Kamli', 'Beedi', 'Saami Saami', 'Dance Pe Chance']
  },

  // Punjabi
  {
    id: 'sin_diljit',
    name: 'Diljit Dosanjh',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer & Actor',
    languages: ['Punjabi', 'Hindi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/79b85e695e0ca6529e56bf3b628e92bd/500x500-000000-80-0-0.jpg',
    knownFor: ['G.O.A.T.', 'MoonChild Era', 'Amar Singh Chamkila', 'Ghost'],
    popularTracks: ['Lover', 'Kinni Kinni', 'Born to Shine', 'Naina', 'Hass Hass']
  },
  {
    id: 'sin_ap_dhillon',
    name: 'AP Dhillon',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer & Producer',
    languages: ['Punjabi', 'English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/52594ac9fa763dc163ed13d21cb130ec/500x500-000000-80-0-0.jpg',
    knownFor: ['Hidden Gems', 'Two Hearts Never Break the Same'],
    popularTracks: ['Brown Munde', 'Insane', 'Excuses', 'With You', 'Dil Nu']
  },

  // English & Global
  {
    id: 'sin_the_weeknd',
    name: 'The Weeknd',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer & Producer',
    languages: ['English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/500x500-000000-80-0-0.jpg',
    knownFor: ['After Hours', 'Starboy', 'Dawn FM', 'Beauty Behind the Madness'],
    popularTracks: ['Blinding Lights', 'Starboy', 'Save Your Tears', 'Die For You']
  },
  {
    id: 'sin_taylor_swift',
    name: 'Taylor Swift',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer-Songwriter',
    languages: ['English'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/500x500-000000-80-0-0.jpg',
    knownFor: ['1989', 'Folklore', 'Midnights', 'The Tortured Poets Department'],
    popularTracks: ['Anti-Hero', 'Cruel Summer', 'Blank Space', 'Cardigan']
  },
  {
    id: 'sin_ed_sheeran',
    name: 'Ed Sheeran',
    category: 'ARTIST',
    role: 'SINGER',
    roleTitle: 'Singer-Songwriter',
    languages: ['English', 'Punjabi'],
    imageUrl: 'https://cdn-images.dzcdn.net/images/artist/d6bb84390641d8ae9118228d9544e53d/500x500-000000-80-0-0.jpg',
    knownFor: ['Divide', 'Multiply', 'Equals', 'Subtract'],
    popularTracks: ['Shape of You', 'Perfect', 'Bad Habits', 'Photograph']
  }
];

export function queryArtistsCatalog(options?: {
  languages?: string[];
  role?: 'DIRECTOR' | 'SINGER' | 'ALL';
  category?: 'ARTIST';
  query?: string;
  limit?: number;
  includeAllLanguages?: boolean;
}): ArtistItem[] {
  const result = CanonicalArtistService.getArtists({
    languages: options?.languages,
    role: options?.role,
    query: options?.query,
    limit: options?.limit || 100,
    includeAllLanguages: options?.includeAllLanguages
  });
  return result.artists;
}

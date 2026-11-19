// The four pillars of the SafePlate Trust Score, with the problems residents reported in our research
export const PILLARS = [
  {
    key: 'food', label: 'Food', icon: '🥘', color: '#E07A1F',
    question: 'How is the food?',
    issues: [
      ['oily', 'Too oily'], ['less_variety', 'Same menu daily'], ['thick_chapati', 'Thick / hard chapatis'],
      ['stale_food', 'Stale food'], ['bad_water', 'Drinking water not safe'],
    ],
  },
  {
    key: 'hygiene', label: 'Hygiene', icon: '🧹', color: '#0E7C66',
    question: 'How clean is the PG?',
    issues: [
      ['dirty_linen', 'Dirty mats / curtains'], ['dust', 'Dusty rooms'], ['cockroaches', 'Cockroaches'],
      ['rats', 'Rats'], ['ants_lizards', 'Ants / lizards'], ['dirty_kitchen', 'Dirty kitchen'],
    ],
  },
  {
    key: 'amenities', label: 'Amenities', icon: '🛠️', color: '#3B5BDB',
    question: 'How are the facilities & service?',
    issues: [
      ['no_washing_machine', 'Washing machine issues'], ['no_fridge', 'No / broken fridge'], ['no_parking', 'No parking'],
      ['slow_service', 'Slow service'], ['repairs_pending', 'Repairs never done'],
    ],
  },
  {
    key: 'security', label: 'Security', icon: '🔒', color: '#B42318',
    question: 'How safe do you feel?',
    issues: [
      ['unsafe_women', 'Not safe for women'], ['cctv_broken', 'CCTV not working'], ['unsafe_area', 'Area feels unsafe'],
      ['no_guard', 'No guard / open gate'],
    ],
  },
]
export const ISSUE_LABEL = Object.fromEntries(PILLARS.flatMap(p => p.issues))

export const AMENITIES = [
  ['wifi', 'Wi-Fi'], ['ac', 'AC'], ['ro_water', 'RO water'], ['washing_machine', 'Washing machine'], ['fridge', 'Fridge'],
  ['parking', 'Parking'], ['cctv', 'Working CCTV'], ['guard', 'Security guard'], ['housekeeping', 'Daily cleaning'],
  ['power_backup', 'Power backup'], ['geyser', 'Geyser'], ['meals', 'Meals included'],
]
export const AMENITY_LABEL = Object.fromEntries(AMENITIES)

// Team audit checklist used during the physical visit
export const CHECKLIST = [
  ['kitchen_clean', 'Kitchen clean on visit'], ['ro_serviced', 'RO serviced in last 3 months'], ['pest_control', 'Pest control in last 3 months'],
  ['menu_displayed', 'Weekly menu displayed'], ['cctv_working', 'CCTV working (checked)'], ['fire_safety', 'Fire extinguisher present'],
  ['washroom_clean', 'Washrooms clean'], ['owner_responsive', 'Owner / manager on-site'],
]

export const GENDER_LABEL = { boys: 'Boys', girls: 'Girls', coed: 'Co-ed' }

export const scoreColor = (s) => (s == null ? '#98A2B3' : s >= 4 ? '#0E7C66' : s >= 3 ? '#B7791F' : '#B42318')
export const rupees = (n) => (n == null ? '' : '₹' + Number(n).toLocaleString('en-IN'))
export const rentText = (p) =>
  p.rent_min ? (p.rent_max && p.rent_max !== p.rent_min ? `${rupees(p.rent_min)}–${rupees(p.rent_max)}` : rupees(p.rent_min)) + '/mo' : null

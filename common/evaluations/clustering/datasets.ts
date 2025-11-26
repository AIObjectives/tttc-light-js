// Dataset 1: Pet preferences data
export const petPreferencesComments = `I love cats because they're so independent and clean themselves
Cats are perfect for apartment living, they don't need much space
My cat provides amazing emotional support when I'm stressed
Dogs are incredibly loyal and protective of their families
I love taking my dog for long walks every morning, it keeps us both healthy
Dogs require a lot of training but it's so worth it for the bond you build
Training a puppy is exhausting but rewarding
I'm not sure about birds, they seem loud and messy
Parrots are fascinating and can be very affectionate, but they need tons of attention
Fish tanks are beautiful and relaxing to watch
I'd love to have a dog but my apartment is too small
The cost of vet bills for pets is really adding up
Pet insurance has saved me thousands on emergency vet visits
Rabbits are underrated pets, they're smart and can be litter trained
Guinea pigs are great starter pets for kids, very gentle
Hamsters are nocturnal so they keep me up at night
Reptiles like bearded dragons are low maintenance compared to furry pets
I work long hours so I can't commit to a high-maintenance pet
Adopting from shelters is important to me, so many animals need homes
Cats are hunters by nature, mine keeps bringing me "presents"
Dogs need daily exercise which is hard with my schedule
Small pets like rabbits don't live very long which is heartbreaking
The initial cost of setting up a proper aquarium is surprisingly high
I'm allergic to cats but hypoallergenic breeds might work for me`;

export const petPreferencesDataset = {
  id: "pet-preference-comments",
  comments: petPreferencesComments,
};

// Dataset 2: Social media discussions - Climate change opinions
export const socialMediaComments = `I think we need to take climate change more seriously, the evidence is overwhelming
Solar panels on my roof have cut my electricity bill in half
Electric cars are the future, gas vehicles will be obsolete in 20 years
I'm skeptical about how much impact individual actions really have
Carbon taxes just hurt working families who can't afford green alternatives
Companies need to be held accountable for their emissions, not consumers
The wildfires this summer were absolutely devastating to our community
I've been trying to reduce my meat consumption for environmental reasons
Flying less is one of the biggest changes individuals can make
Public transportation infrastructure needs massive investment
Nuclear energy is actually the cleanest and most reliable option we have
Wind farms are ruining the natural landscape in rural areas
Young people are rightfully angry about the world we're leaving them
The Green New Deal goes too far and would destroy the economy
I've started composting and it's easier than I expected
Fast fashion is a huge contributor to pollution that nobody talks about
Climate scientists have been warning us for decades and we ignored them
Some climate regulations are necessary but many go overboard
Renewable energy jobs are growing faster than fossil fuel jobs
We need to balance environmental protection with economic growth`;

export const socialMediaDataset = {
  id: "social-media-comments",
  comments: socialMediaComments,
};

// Dataset 3: Employee feedback - Tech company
export const employeeFeedbackComments = `The flexible remote work policy has been a game changer for my work-life balance
I feel like management doesn't listen to feedback from individual contributors
The salary is competitive but the bonus structure is confusing and seems arbitrary
Our team lead is amazing at mentoring junior developers and creating growth opportunities
The office kitchen is always a mess and nobody cleans up after themselves
Health insurance benefits are excellent, especially the mental health coverage
There's way too many meetings, I can barely get actual work done
The company culture feels like it's changed a lot since we went public
I appreciate that we get professional development budget for courses and conferences
The PTO policy is generous but I feel guilty actually using it because everyone is so busy
Our sprint planning process is chaotic and deadlines feel unrealistic
I love the diversity initiatives the company has been rolling out
The code review process is really thorough and has made me a better engineer
Upper management seems disconnected from what's actually happening on the ground
The new office space is beautiful but it's too loud to concentrate
Career progression feels unclear, I don't know what I need to do to get promoted
The on-call rotation is burning people out, we need more coverage
I've made some of my best friends here, the team social events are great
The tech stack is modern and I'm learning valuable skills
Leadership keeps changing direction on our product roadmap and it's frustrating`;

export const employeeFeedbackDataset = {
  id: "employee-feedback-comments",
  comments: employeeFeedbackComments,
};

// Dataset 4: Product reviews - Wireless headphones
export const productReviewComments = `The noise cancellation on these headphones is absolutely incredible
Battery life is disappointing, I have to charge them every day
Sound quality is amazing, much better than my previous pair
They're comfortable for the first hour but then my ears start hurting
The Bluetooth connection keeps dropping when I'm more than 10 feet from my phone
Customer service was super helpful when I had issues with the fit
These are way overpriced for what you get
The bass is really punchy and satisfying for hip-hop and EDM
I love that they fold up small enough to fit in my bag
The touch controls are intuitive and work reliably
The companion app is buggy and crashes frequently
They look sleek and premium, I get compliments all the time
The microphone quality is terrible for phone calls
Fast charging is a lifesaver when I forget to charge overnight
They leak sound at higher volumes which is embarrassing on the train
The noise cancellation makes my ears feel pressurized and uncomfortable
Build quality feels solid, they seem like they'll last years
The carrying case is nice but takes up too much space
They're perfect for working from home and blocking out distractions
I wish there was an equalizer to customize the sound profile
The auto-pause when you take them off is a great feature
White color shows dirt really easily
Transparency mode works well for hearing announcements without removing them
The headband is too tight and gives me headaches after extended use
Great value compared to the premium brands
Volume controls are oddly placed and I hit them accidentally
They work seamlessly with my iPhone but had trouble pairing with my laptop
The default sound signature is too bass-heavy for my taste`;

export const productReviewDataset = {
  comments: productReviewComments,
};

// Export all datasets as an array for easy iteration
export const clusteringDatasets = [
  petPreferencesDataset,
  socialMediaDataset,
  employeeFeedbackDataset,
  productReviewDataset,
];

export interface WouldYouRatherQuestion {
  id: string;
  question: string;
  options: [string, string];
  followUp: string;
}

// Original conversation starters, with no correct answer or relationship verdict.
export const WOULD_YOU_RATHER: WouldYouRatherQuestion[] = [
  { id: 'wyr-en2-0', question: 'Pick your kind of mini escape.', options: ['A cabin with rain on the roof', 'A sunny room near the sea'], followUp: 'What is the first thing you do when you arrive?' },
  { id: 'wyr-en2-1', question: 'You get one oddly useful talent.', options: ['Always find the perfect gift', 'Always pick the best dish on the menu'], followUp: 'Tell a story about a time this would have helped.' },
  { id: 'wyr-en2-2', question: 'Which good day would you rather have?', options: ['A carefully planned adventure', 'A completely accidental great day'], followUp: 'How much uncertainty is fun for you?' },
  { id: 'wyr-en2-3', question: 'Choose your free upgrade.', options: ['A home that cleans itself', 'Dinner appears every evening'], followUp: 'What would you do with the time you get back?' },
  { id: 'wyr-en2-4', question: 'Pick a small weekly ritual.', options: ['Breakfast at a favourite place', 'A long walk somewhere new'], followUp: 'What would make you look forward to it?' },
  { id: 'wyr-en2-5', question: 'Which kind of surprise wins?', options: ['Someone remembers a tiny detail', 'Someone plans a whole day for you'], followUp: 'What makes a surprise feel thoughtful to you?' },
  { id: 'wyr-en2-6', question: 'Your evening is suddenly free.', options: ['Invite someone over', 'Keep the evening to yourself'], followUp: 'Would your answer have been different last week?' },
  { id: 'wyr-en2-7', question: 'Choose a dinner rule for one month.', options: ['Never repeat a meal', 'Eat your favourites on rotation'], followUp: 'Where else do you prefer novelty or familiarity?' },
  { id: 'wyr-en2-8', question: 'Pick your imaginary shop.', options: ['A tiny bookshop with coffee', 'A snack shop open late'], followUp: 'Name it and describe your regular customers.' },
  { id: 'wyr-en2-9', question: 'You can relive one kind of moment.', options: ['A huge laugh with your people', 'A quiet moment when everything felt right'], followUp: 'Which actual memory comes to mind?' },
  { id: 'wyr-en2-10', question: 'Choose your ideal plus-one.', options: ['Excellent at making plans', 'Excellent at making any plan fun'], followUp: 'Which quality do you tend to bring?' },
  { id: 'wyr-en2-11', question: 'Pick one household superpower.', options: ['Laundry is always done', 'You never lose small things'], followUp: 'What object would this rescue most often?' },
  { id: 'wyr-en2-12', question: 'Which trip sounds more like you?', options: ['One place explored slowly', 'Several places in one adventure'], followUp: 'What makes a trip feel complete?' },
  { id: 'wyr-en2-13', question: 'You get a spare room.', options: ['A quiet reading and hobby room', 'A room for friends and game nights'], followUp: 'What is the first thing you put in it?' },
  { id: 'wyr-en2-14', question: 'Choose a kind of confidence.', options: ['Comfortable meeting anyone', 'Comfortable trying anything new'], followUp: 'Where would you use it this week?' },
  { id: 'wyr-en2-15', question: 'Pick your ideal invitation.', options: ['All the details a week ahead', 'A spontaneous plan that starts in an hour'], followUp: 'What could turn your less favourite option into a yes?' },
  { id: 'wyr-en2-16', question: 'Which would you rather be known for?', options: ['Making people feel welcome', 'Making people see things differently'], followUp: 'Who in your life does this well?' },
  { id: 'wyr-en2-17', question: 'Choose a low-stakes competition.', options: ['A snack taste test', 'A very serious trivia night'], followUp: 'How competitive would you actually get?' },
  { id: 'wyr-en2-18', question: 'One small annoyance disappears forever.', options: ['No waiting in queues', 'No searching for parking'], followUp: 'What would you be suspiciously willing to pay for that?' },
  { id: 'wyr-en2-19', question: 'Pick a creative challenge.', options: ['Make a surprisingly good short film', 'Cook a surprisingly good three-course meal'], followUp: 'Who would get the first viewing or tasting?' },
  { id: 'wyr-en2-20', question: 'Which would make you feel more understood?', options: ['Someone asks exactly the right question', 'Someone helps without a long explanation'], followUp: 'When would the other option matter more?' },
  { id: 'wyr-en2-21', question: 'Choose a day off with one condition.', options: ['No screens', 'No schedule'], followUp: 'Which condition would be harder than it sounds?' },
  { id: 'wyr-en2-22', question: 'Pick a tiny time-travel privilege.', options: ['Revisit an ordinary childhood afternoon', 'Preview an ordinary day five years from now'], followUp: 'What detail would you pay attention to?' },
  { id: 'wyr-en2-23', question: 'What would you rather discover nearby?', options: ['A beautiful quiet walking route', 'An excellent affordable place to eat'], followUp: 'Who would you tell first?' },
  { id: 'wyr-en2-24', question: 'Choose a personal archive.', options: ['Every kind thing someone said about you', 'Every funny moment you forgot'], followUp: 'Which one would you open on a difficult day?' },
  { id: 'wyr-en2-25', question: 'Pick your kind of learning.', options: ['Master one skill deeply', 'Try a new skill every month'], followUp: 'What skill would be first on your list?' },
  { id: 'wyr-en2-26', question: 'Which care package would you choose?', options: ['Your favourite practical essentials', 'A collection of thoughtful surprises'], followUp: 'Name one thing it absolutely needs.' },
  { id: 'wyr-en2-27', question: 'You can protect one hour each day.', options: ['An unhurried morning hour', 'An unhurried evening hour'], followUp: 'What would you stop squeezing into five minutes?' },
  { id: 'wyr-en2-28', question: 'Choose an evening with people you love.', options: ['Everyone cooks something together', 'Everyone brings a favourite game'], followUp: 'What is your contribution?' },
  { id: 'wyr-en2-29', question: 'Pick a slightly ridiculous convenience.', options: ['A soundtrack that matches your mood', 'A narrator who explains your decisions'], followUp: 'What would it sound like today?' },
  { id: 'wyr-en2-30', question: 'Which would you rather receive?', options: ['A letter to read years from now', 'A photo of an ordinary moment you missed'], followUp: 'Why would that feel worth keeping?' },
  { id: 'wyr-en2-31', question: 'Choose how your next good story begins.', options: ['We took the wrong turn', 'We finally tried the thing we kept postponing'], followUp: 'What real-life plan could become that story?' },
];

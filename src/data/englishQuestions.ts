// Original English prompts. Keep array order stable and append new cards:
// questions.ts gives each entry a versioned history ID shared across game modes.
import type { QuestionMood } from './questionMood';
import { extraVibes, extraDeep, extraRelationship, extraMatureGroups, extraGuesses, extraMatches, type ConversationRow, type ChoiceRow } from './conversationExtras';

export interface ConversationPrompt { question: string; followUp: string; mood: QuestionMood }
export interface ChoicePrompt extends ConversationPrompt { options: [string, string, string, string] }
const conversation = (items: ConversationRow[], defaultMood: QuestionMood = 'deep'): ConversationPrompt[] =>
  items.map(([question, followUp, mood = defaultMood]) => ({ question, followUp, mood }));
const choice = (items: ChoiceRow[]): ChoicePrompt[] =>
  items.map(([question, options, followUp, mood = 'easy']) => ({ question, options, followUp, mood }));

export const englishRiddles = [
  ['What gets wetter the more it dries something else?', 'A towel. It absorbs water while drying other things.'],
  ['What belongs to you, but other people usually say it more than you do?', 'Your name.'],
  ['What has many keys but cannot unlock a door?', 'A piano. Its keys make music.'],
  ['What has a neck but no head?', 'A bottle. Other answers that fit count too.'],
  ['What can travel around the world while staying in the corner of an envelope?', 'A postage stamp.'],
  ['What has one eye but cannot see?', 'A needle. Its eye is the hole for the thread.'],
  ['What gets bigger the more you take away from it?', 'A hole.'],
  ['What has a thumb and four fingers but is not alive?', 'A glove.'],
  ['What word becomes shorter when you add two letters to it?', 'Short. Add E and R to make shorter.'],
  ['You pass the runner in second place. What place are you in now?', 'Second. You took their place; the runner in first is still ahead.'],
  ['A farmer has 17 sheep. All but nine run away. How many are left?', 'Nine. All but nine means that nine stayed.'],
  ['Two fathers and two sons share three buns. Everyone gets one whole bun. How?', 'There are three people: a grandfather, his son, and his grandson. The middle person is both a father and a son.'],
  ['What comes once in a minute, twice in a moment, and never in a thousand years?', 'The letter M.'],
  ['What has cities, roads, and rivers, but no people, cars, or water?', 'A map.'],
  ['A rooster lays an egg on the peak of a roof. Which side does it roll down?', 'Neither. Roosters do not lay eggs.'],
  ['What can fill a room without taking up physical space?', 'Light. Sound is another reasonable answer.'],
  ['Which month has 28 days?', 'All twelve months have at least 28 days.'],
  ['What can you break just by saying something?', 'Silence. A promise can also fit, depending on what you say.'],
  ['What goes up every birthday and never comes down?', 'Your age.'],
  ['An electric train travels north and the wind blows west. Which way does its smoke go?', 'Nowhere. An electric train does not produce exhaust smoke.'],
  ['You have one match, a candle, and an unlit oil lamp. What must you light first?', 'The match.'],
  ['Which is heavier: one kilogram of feathers or one kilogram of bricks?', 'Neither. Both weigh one kilogram.'],
  ['What has words but never speaks aloud by itself?', 'A printed book. A newspaper or a sign also fits.'],
  ['What part of your left arm can you hold with your right hand, but not with your left hand?', 'Your left elbow.'],
].map(([soalan, jawapan]) => ({ soalan, jawapan }));

export const englishVibes = conversation([
  ['What harmless thing are you surprisingly competitive about?', 'Tell the story of the last time it brought out your competitive side.'],
  ['What tiny inconvenience turns you into a completely different person?', 'What usually gets you back into a good mood?'],
  ['What is your most defensible unpopular food opinion?', 'Build the meal that would win someone over.'],
  ['What purchase under RM30 has improved your life more than it should?', 'Would you buy it again today?'],
  ['What would your friends put on your very unofficial warning label?', 'Which part is fair, and which part would you appeal?'],
  ['What ordinary skill would you enter a very small competition for?', 'Describe your winning performance.'],
  ['Which part of a holiday do you secretly enjoy most?', 'The planning, the trip, or the stories afterwards? Pick a specific moment.'],
  ['What is a completely ordinary day you would happily repeat?', 'Describe it from the first drink to the last thing you did.'],
  ['What is the most specific thing that instantly makes a place feel cosy?', 'Where did you first notice you liked it?'],
  ['What do you research far more thoroughly than necessary?', 'What is the most useful thing you learned from that rabbit hole?'],
  ['What is your personal sign that you have become comfortable around someone?', 'What changes about the way you act?'],
  ['Which small task do you keep putting off even though it takes five minutes?', 'What would make it easier to start?'],
  ['If your week had a review headline, what would it say?', 'Give the week a star rating and explain the missing stars.'],
  ['What trend did you judge and then quietly start enjoying?', 'Who gets to say they told you so?'],
  ['Which household object would you save from being replaced forever?', 'Is it useful, sentimental, or just weirdly perfect?'],
  ['What is a compliment you still remember because it was so specific?', 'What did the person notice that others usually missed?'],
  ['What does your ideal cancelled plan look like?', 'What do you do with the unexpected free time?'],
  ['What is your least dramatic but most persistent grudge?', 'Keep it to something harmless, like a discontinued snack.'],
  ['What would you happily give a ten-minute talk about with no preparation?', 'Start with your most interesting opening line.'],
  ['What is something you are much better at in your head?', 'What would the real-world version need to improve?'],
  ['What tiny luxury makes an average day feel expensive?', 'How often do you actually let yourself have it?'],
  ['What would the first three chapters of your instruction manual be called?', 'Which chapter would save someone the most confusion?'],
  ['What do you always notice first in someone else\'s home?', 'What does your own space say about you?'],
  ['Which errand becomes fun with the right company?', 'What would make it a proper little outing?'],
  ['What is your most irrationally specific seat preference?', 'Window, corner, facing the door: make your case.'],
  ['What is a small decision you made that had a surprisingly good outcome?', 'Would you make it the same way again?'],
  ['What is your favourite way to spend half an hour with no obligations?', 'Does it leave you recharged or wondering where the time went?'],
  ['What minor problem should already have been solved by now?', 'Pitch your overengineered solution.'],
  ['If you could borrow a friend\'s talent for one afternoon, which would you choose?', 'What would you make or do first?'],
  ['What is the best thing about you that a first impression might miss?', 'What situation tends to bring it out?', 'deep'],
  ['Which activity makes you forget to check your phone?', 'When did you last make time for it?'],
  ['What did you think was incredibly fancy when you were a child?', 'Does a little part of you still think so?'],
  ['What is the most you have committed to a joke?', 'At what point did it become more work than expected?'],
  ['Which everyday sound do you love?', 'What place or memory does it bring back?'],
  ['What is your signature move when you do not know anyone at a gathering?', 'How can someone make it easier to join in?'],
  ['What would make a perfect unplanned evening?', 'You have two hours, no bookings, and a modest budget.'],
  ...extraVibes,
], 'fun');

export const englishMatureGroups = [
  conversation([
    ['What is worth spending a little more on, even when you are saving?', 'Where would you cut back to make room for it?'],
    ['If you shared a budget with someone, what would you still want to decide independently?', 'Name a purchase size you would want to discuss first.'],
    ['What did your family teach you about money without actually saying it?', 'Which lesson would you keep, and which would you change?'],
    ['What would a financially comfortable ordinary month look like to you?', 'Describe the feeling and habits before naming a number.'],
    ['How would you want to bring up a debt or money mistake with a partner?', 'What response would help you be honest early?'],
    ['What is one money habit you are proud of and one you are still working on?', 'What small change would make the second one easier?'],
    ['If one person earned much more, what would fair shared expenses look like?', 'Consider time, care, and responsibilities as well as income.'],
    ['How would you balance helping family with protecting your own plans?', 'What limit would you want to agree on before a request arrives?'],
  ]),
  conversation([
    ['What family tradition would you like to carry into your own home?', 'What would you adapt to make it work for the people living there?'],
    ['How much notice would you want before someone invited guests over?', 'What changes if it is family or if someone needs help?'],
    ['When family advice clashes with your own plans, how do you handle it?', 'What respectful sentence could you use to hold a boundary?'],
    ['Which details of a relationship should stay between the people in it?', 'When would you want outside support or advice?'],
    ['How would you split a holiday when both families hope you will visit?', 'What would feel fair over a whole year, rather than one day?'],
    ['What does feeling welcome in someone else\'s family look like to you?', 'Name one small thing a partner could do to help.'],
    ['How would you respond if a relative made a joke that hurt your partner?', 'What could support look like in the moment and afterwards?'],
    ['What boundary would help you enjoy family time more?', 'How could you explain it warmly and clearly?'],
  ]),
  conversation([
    ['Which household task would you happily own, and which would you trade away?', 'Include the planning and remembering, not just the visible task.'],
    ['What does a fair division of chores look like during a difficult week?', 'How would you ask to rebalance it without keeping score?'],
    ['If an exciting job meant moving away, what would you need to discuss first?', 'Whose routines, support, and opportunities would change?'],
    ['What does being off work actually mean to you?', 'When would checking a work message feel reasonable?'],
    ['How much time alone helps you show up well for other people?', 'What could you say so it feels like a request, not a rejection?'],
    ['What level of mess makes a home feel uncomfortable to you?', 'Which shared space matters most, and what can you let go?'],
    ['How would you make an ordinary Tuesday together feel good?', 'Pick one habit that takes less than fifteen minutes.'],
    ['When both people are exhausted, what is your minimum viable evening?', 'Decide what can wait and what still needs a little care.'],
  ]),
  conversation([
    ['Which part of your future feels clear, and which part are you happy to leave open?', 'What would help you make the next decision?'],
    ['How do you currently feel about raising children, if at all?', 'What would you want a partner to understand without trying to persuade you?'],
    ['What kind of support helps when you are overwhelmed?', 'Give an example of help that sounds good but usually misses the mark.'],
    ['What would you want to keep doing together after life got much busier?', 'How could you protect a smaller version of that ritual?'],
    ['What does commitment look like in your day-to-day behaviour?', 'Choose an action someone could actually notice.'],
    ['How would you want to revisit a plan if one person changed their mind?', 'What would make that conversation feel fair to both people?'],
    ['What kind of home atmosphere would you like to create?', 'Describe how a visitor or a tired version of you would feel there.'],
    ['What do you hope a future version of you has stopped worrying about?', 'What could the present version of you do to help?'],
  ]),
].map((group, index) => [...group, ...conversation(extraMatureGroups[index])]);

export const englishSensitive = conversation([
  ['How do you let someone know a joke crossed a line for you?', 'What response would help you feel heard? You can use a fictional example.'],
  ['What would make it easier to say you are not ready to talk yet?', 'How could you agree on a time to return to the conversation?'],
  ['What does privacy mean to you when you are close to someone?', 'Discuss expectations around phones or messages without sharing private content.'],
  ['If trust had been shaken, what would rebuilding it need to involve?', 'Keep it hypothetical if you prefer. What actions would matter over time?'],
  ['How would you want a partner to respond when you say no to a plan or affection?', 'What helps a no feel safe and easy to say?'],
  ['What is something about your background you want people to ask about more thoughtfully?', 'You can describe the better question without answering it.'],
  ['How do you recognise when a disagreement needs a pause?', 'What signal and return time could both people understand?'],
  ['What would make asking for help feel easier during a hard season?', 'Choose one practical form of support. Share only what feels comfortable.'],
]);

export const englishDeep = conversation([
  ['What part of yourself have you grown to appreciate more with age?', 'What helped you change your mind about it?'],
  ['When did you last feel quietly proud of yourself?', 'What would someone have missed if they only saw the outcome?'],
  ['What belief of yours has become less certain in a useful way?', 'What experience complicated the picture?'],
  ['What do you miss about a past version of yourself?', 'Is there a small part you could bring back?'],
  ['What does a good life look like on a completely unremarkable day?', 'Leave achievements out for a moment. What is actually happening?'],
  ['What do you wish people understood about the way you show care?', 'How could you make that care easier to recognise?'],
  ['What are you learning to do without apologising for it?', 'What still makes it difficult?'],
  ['Who has made you feel understood without needing a long explanation?', 'What did they notice or do?'],
  ['What is one thing you would like more courage for this year?', 'What would a very small first attempt look like?'],
  ['Which memory would you keep if you could save an ordinary moment in a jar?', 'Describe one detail you would not want to lose.'],
  ['What kind of attention makes you feel most valued?', 'When did someone last give you that kind of attention?'],
  ['What are you hoping will take up less space in your mind?', 'What would you like to make room for instead?'],
  ...extraDeep,
]);

export const englishRelationship = conversation([
  ['What is a small gesture that would tell you someone had really listened?', 'Give an example that does not involve spending money.'],
  ['How would you like someone to raise a concern before it turns into resentment?', 'Try an opening sentence you would find easy to hear.'],
  ['What does a useful apology sound like to you?', 'What would you hope happened after the words?'],
  ['Which everyday decision would you enjoy sharing, and which would you rather handle yourself?', 'What makes collaboration helpful or tiring for you?'],
  ['How do you want to celebrate a win that matters mostly to you?', 'What would make the celebration feel personal?'],
  ['When you are stressed, what do people sometimes misread about you?', 'What could you tell them before it happens again?'],
  ['What is an early sign that you need more quality time with someone?', 'What would be a simple way to reconnect?'],
  ['How would you want to handle a plan that only one person is excited about?', 'What makes a compromise feel generous rather than obligatory?'],
  ['What makes a thoughtful gift feel thoughtful to you?', 'Is it the surprise, the usefulness, the effort, or something else?'],
  ['Which friendship habits would you want to protect in a relationship?', 'How could both people keep room for their own people?'],
  ['What would help you feel like a team during a stressful errand?', 'Pick a real situation and give each person a useful job.'],
  ['What is one thing you would like a partner to ask instead of assume?', 'How would you answer that question today?'],
  ...extraRelationship,
]);

export const englishExpectations = conversation([
  ['What relationship rule do people treat as obvious that you think should be discussed?', 'What would you agree on explicitly?'],
  ['What does replying to a message reasonably quickly mean in your life?', 'How does the answer change at work, with friends, or on a busy day?'],
  ['How would you decide who pays for an early date?', 'What makes the conversation feel easy rather than awkward?'],
  ['How public would you want a relationship to be online?', 'What would you want someone to ask before posting?'],
  ['What does punctuality communicate to you?', 'What update would you appreciate when someone is running late?'],
  ['Which expectations about being a good partner do you want to question?', 'Which expectations still feel useful to you?'],
  ['How do you feel about surprises that affect your schedule?', 'Where is the line between thoughtful and inconvenient?'],
  ['What does showing up for someone mean when you cannot be there in person?', 'Name something small and realistic that would count.'],
]);

export const englishChallenges = conversation([
  ['Give today a six-word review.', 'Solo: write your six words, then explain one. Together: share yours before explaining; guess which moment inspired each other.'],
  ['Pitch a terrible business idea with absolute confidence.', 'Take thirty seconds to sell it. Solo: invent its first customer complaint. Together: the other person asks one serious investor question.'],
  ['Build a three-song soundtrack for an ordinary day.', 'Choose a morning song, an afternoon song, and an ending. No audio or app needed. Together: compare the moods you picked.'],
  ['Invent a tiny holiday that should exist.', 'Give it a name, a tradition, and an acceptable snack. Solo: imagine your celebration. Together: combine your best ideas.'],
  ['Describe your ideal cafe using exactly five details.', 'You can write or say them. Together: design it separately, then find one detail you would both keep.'],
  ['Give an everyday object a dramatic product launch.', 'Choose something nearby and deliver a twenty-second pitch. Solo: add a ridiculous slogan. Together: rate only the enthusiasm.'],
  ['Make up a title for the chapter of life you are in.', 'Add the first sentence. Together: share your own titles, then suggest a kind subtitle for each other.'],
  ['Plan a good evening with a budget of RM20.', 'You do not need to buy anything. Name the activity, the snack, and the best part. Together: negotiate one shared plan.'],
  ['Tell a two-sentence story with an unexpected ending.', 'Use the words umbrella, receipt, and Tuesday. Solo: write both sentences. Together: take one sentence each.'],
  ['Design a personal museum with just three exhibits.', 'Pick an object, a photo, and a sound from your life. Together: give each other the guided tour without needing the actual items.'],
  ['Make a friendly case for your most ordinary talent.', 'You have twenty seconds. Solo: award yourself an unnecessarily formal title. Together: the listener names a second talent they noticed.'],
  ['Draw your current mood as weather.', 'Paper, a notes app, or a description all work. Together: explain what might make the forecast better.'],
  ['Create a menu for a restaurant based on your personality.', 'Name one main, one side, and one drink. Together: guess what each item represents before the explanation.'],
  ['Choose three objects for a time capsule of this year.', 'Imaginary objects count. Solo: add a note to future you. Together: decide on one extra item for a shared capsule.'],
  ['Tell the story of your day as a nature documentary.', 'Narrate one ordinary moment for twenty seconds. Solo: include a dramatic pause. Together: the listener supplies the documentary title.'],
  ['Make a list of five small things that are going right.', 'They can be very ordinary. Together: alternate items. Solo: circle the one you tend to overlook.'],
  ['Design a low-effort tradition for the end of a long week.', 'It must take less than ten minutes and cost nothing. Together: agree on a version you would both enjoy.'],
  ['Write the worst possible directions to an imaginary cafe.', 'Keep them funny, not useful. Solo: add a landmark. Together: take turns adding one increasingly unhelpful instruction.'],
  ['Choose a fictional skill you would trade one real skill for.', 'Explain the trade. Together: the other person decides whether the deal needs a better offer.'],
  ['Create a tiny award for something you handled recently.', 'Name the award and give a ten-second acceptance speech. Together: offer each other a specific, sincere runner-up award.'],
], 'fun');

export const englishGuesses = choice([
  ['Which little treat would I choose after a long day?', ['A favourite snack', 'A long shower', 'A comfort episode', 'An early night'], 'What makes that one feel like a reset?'],
  ['What is my first move in a new city?', ['Find somewhere to eat', 'Walk without a plan', 'Visit a saved place', 'Settle in and rest'], 'What does that choice say about how I like to travel?'],
  ['Which kind of surprise would I enjoy most?', ['A thoughtful note', 'A planned outing', 'A useful little gift', 'An unexpected meal'], 'What detail would make the surprise feel personal?'],
  ['When I am stuck on a problem, what helps me first?', ['Talking it through', 'Quiet thinking time', 'A practical suggestion', 'A complete distraction'], 'Does my answer change depending on the problem?'],
  ['Which role would I probably take on a group trip?', ['Planner', 'Food scout', 'Photo collector', 'Happy passenger'], 'Which job would I gladly hand to someone else?'],
  ['What would I do with an unexpectedly free hour?', ['Take a walk', 'Finish a small task', 'Call someone', 'Do absolutely nothing'], 'What usually stops me making time for it?'],
  ['Which compliment would stay with me longest?', ['You made that easier', 'You noticed the details', 'You made me laugh', 'I can count on you'], 'Why does that particular compliment land?'],
  ['What makes a cafe my kind of place?', ['Excellent drinks', 'Comfortable seating', 'A calm atmosphere', 'Interesting food'], 'What would make me leave sooner than planned?'],
  ['Which part of hosting would I care about most?', ['Feeding everyone well', 'Making people comfortable', 'A good activity', 'A relaxed atmosphere'], 'What can guests do that makes hosting easier?'],
  ['What am I most likely to keep as a souvenir?', ['A photo', 'A useful object', 'A ticket or receipt', 'A local snack'], 'Which souvenir have I actually kept longest?'],
  ['Which kind of plan makes me happiest right now?', ['Something outdoors', 'A slow day at home', 'Trying something new', 'Seeing familiar people'], 'Has this answer changed recently?'],
  ['How do I usually react to a delayed plan?', ['Rework the schedule', 'Find a nearby snack', 'Enjoy the extra time', 'Ask for a clear update'], 'What kind of delay tests my patience most?'],
  ['What would I choose to learn for fun?', ['A new recipe', 'An instrument', 'A language', 'A creative craft'], 'What would a first attempt look like?'],
  ['Which household upgrade would tempt me most?', ['Better bedding', 'A useful kitchen tool', 'A comfortable chair', 'Warmer lighting'], 'Which one would improve an ordinary day most?'],
  ['What kind of film am I most likely to suggest tonight?', ['A clever mystery', 'A warm comedy', 'A gripping adventure', 'A familiar favourite'], 'Is that my usual choice or just tonight\'s mood?'],
  ['How do I usually show I care?', ['I check in', 'I help with a task', 'I make time', 'I remember small details'], 'Which way is easiest for others to miss?'],
  ['Which part of a celebration matters most to me?', ['The people', 'The food', 'A thoughtful moment', 'Doing something fun'], 'What celebration got this especially right?'],
  ['What am I most likely to overpack?', ['Clothes', 'Snacks', 'Chargers and gadgets', 'Just-in-case items'], 'What have I packed and never once used?'],
  ['What would make a rainy afternoon better for me?', ['A hot drink and a book', 'A nap', 'A film marathon', 'Cooking something'], 'What is the perfect soundtrack for it?'],
  ['When would I prefer to have a difficult conversation?', ['As soon as possible', 'After a short pause', 'During a quiet walk', 'At an agreed time'], 'What would help the conversation start well?', 'deep'],
  ['Which tiny win would I celebrate most?', ['Clearing a nagging task', 'Learning something new', 'Keeping a good habit', 'Saying what I meant'], 'Which one have I had recently?'],
  ['What is my likely approach to assembling furniture?', ['Read every step first', 'Sort all the pieces', 'Start and work it out', 'Find a helpful video'], 'What role would a second person be useful for?'],
  ['What would I pick for a no-pressure date?', ['Coffee and a walk', 'A shared meal', 'A casual activity', 'A relaxed evening in'], 'Which little detail would make it better?'],
  ['What is most likely to distract me in a shop?', ['Stationery', 'Food', 'Home things', 'Books or games'], 'What item do I always pick up and then put back?'],
  ['Which kind of message would make my day?', ['A funny observation', 'A thoughtful check-in', 'An invitation', 'A specific thank-you'], 'What is a message I remember receiving?'],
  ['What would I rather be unexpectedly good at?', ['Cooking without a recipe', 'Fixing things', 'Making people laugh', 'Remembering names'], 'Where would I use that skill first?'],
  ['What helps me feel settled after travelling?', ['Unpacking', 'A proper shower', 'Eating something familiar', 'Sleeping in my own bed'], 'What do I always leave until later?'],
  ['How do I prefer to remember a good day?', ['Take photos', 'Save one small object', 'Tell someone about it', 'Write a few lines'], 'What detail would I want to remember a year later?'],
  ['Which part of a new hobby appeals to me most?', ['Learning the basics', 'Seeing improvement', 'Making something', 'Meeting people'], 'What tends to make me stick with it?'],
  ['What would I choose for a small personal milestone?', ['A nice meal', 'A day off', 'A useful purchase', 'Time with my people'], 'Who would I tell first?'],
  ['What is my preferred way to make a decision?', ['Compare the options', 'Trust my first instinct', 'Talk to someone', 'Try a small version'], 'Which decisions need a different approach?'],
  ['What helps me feel at home in a new place?', ['A familiar routine', 'My favourite objects', 'Knowing the area', 'Someone to talk to'], 'What would I set up first?'],
  ['Which invitation am I most likely to accept last minute?', ['A short walk', 'A favourite meal', 'A game night', 'A small adventure'], 'How much notice would make it an easier yes?'],
  ['What do I value most in a recommendation?', ['It fits my taste', 'It is good value', 'It is a new experience', 'It is easy to arrange'], 'What is the best recommendation I have followed?'],
  ['Which skill would I choose for our imaginary team?', ['Navigation', 'Negotiation', 'Improvisation', 'Keeping everyone calm'], 'What real moment proves I can do it?'],
  ['What would I want after receiving disappointing news?', ['Someone to listen', 'A little space', 'Help with next steps', 'Company without talking'], 'What should someone ask before trying to help?'],
  ['Which kind of memory do I bring up most often?', ['Something funny', 'A proud moment', 'A trip', 'An ordinary good day'], 'Why do I keep returning to it?'],
  ['What matters most when I choose a gift?', ['It is useful', 'It feels personal', 'It is a good surprise', 'We can enjoy it together'], 'Which gift have I enjoyed choosing for someone?'],
  ['What would I protect in a very busy week?', ['Enough sleep', 'Some time alone', 'Time with loved ones', 'One enjoyable activity'], 'How can someone help me protect it?'],
  ['What is my ideal pace for a weekend morning?', ['Up and out early', 'One plan after breakfast', 'Slow and unstructured', 'Decide when I wake up'], 'What is the one thing I would not want to rush?'],
  ...extraGuesses,
]);

export const englishMatches = choice([
  ['A free Saturday opens up. Which plan would you choose?', ['A small day trip', 'A proper rest day', 'A meal with friends', 'One useful project'], 'Which part would you be happy to combine with another answer?'],
  ['You are choosing a place for dinner. What matters most?', ['Something familiar', 'Somewhere new', 'Keeping it affordable', 'A comfortable atmosphere'], 'What could help you decide if your first choices differ?'],
  ['For a shared holiday, how much would you plan?', ['Nearly everything', 'One main thing a day', 'Only travel and rooms', 'As little as possible'], 'Which detail would you want settled before leaving?'],
  ['There is one unexpected free evening. What sounds best?', ['Cook something together', 'Go out for dessert', 'Watch something good', 'Take an evening walk'], 'What makes a simple plan feel like quality time?'],
  ['Which shared tradition would you actually keep?', ['A weekly meal', 'A monthly outing', 'A daily check-in', 'An annual small trip'], 'What would the easiest version look like?'],
  ['You have different opinions on a film. How would you pick?', ['Take turns choosing', 'Find a third option', 'Pick the shorter one', 'Watch separate things'], 'When does taking turns work well for you?'],
  ['What would make a home feel most welcoming?', ['Good food', 'Comfortable spaces', 'Room for friends', 'A calm routine'], 'Name one detail you would add first.'],
  ['How would you prefer to celebrate an anniversary?', ['Return to a favourite place', 'Try a new experience', 'Make a quiet evening special', 'Exchange thoughtful notes'], 'What would matter more than how much it costs?'],
  ['A shared plan goes wrong. What would you do first?', ['Solve the practical problem', 'Check how everyone feels', 'Find the funny side', 'Take a short pause'], 'How could different first reactions complement each other?'],
  ['Which small home project sounds most satisfying?', ['Organising one cupboard', 'Growing something', 'Improving a cosy corner', 'Making a photo display'], 'What would you each contribute?'],
  ['How would you prefer to share routine household jobs?', ['Each own certain jobs', 'Rotate jobs regularly', 'Do them at the same time', 'Decide week by week'], 'How would you account for the planning as well as the doing?'],
  ['What kind of shared goal would be fun this month?', ['Learn one useful skill', 'Save for an experience', 'Build a healthy routine', 'Make something creative'], 'Choose a first step small enough to do this week.'],
  ['What would make a road trip more enjoyable?', ['A great playlist', 'Interesting food stops', 'A scenic route', 'An easy schedule'], 'Which part would you each take charge of?'],
  ['You get a small bonus to enjoy. What would you choose?', ['Save it for a trip', 'Have an excellent meal', 'Upgrade something useful', 'Split it for personal treats'], 'What would make this feel fair if your answers differ?'],
  ['What is your preferred way to reconnect after a busy week?', ['Talk over a meal', 'Do something playful', 'Rest in the same space', 'Get outside together'], 'Would you want conversation right away or time to settle first?'],
  ['What kind of gift exchange sounds nicest?', ['A small spending limit', 'Experiences only', 'Thoughtful surprises', 'Wish lists welcome'], 'What pressure would you like to take out of gift giving?'],
  ['How often would you want to host people at home?', ['Most weeks', 'Once or twice a month', 'For special occasions', 'Mostly meet elsewhere'], 'What would make hosting manageable for both people?'],
  ['Which skill would you most enjoy learning together?', ['Cooking a new cuisine', 'Dancing', 'Taking better photos', 'Making or fixing things'], 'How would you keep being beginners fun?'],
  ['You have different energy levels today. What works best?', ['Choose a gentler plan', 'Do separate things first', 'Keep it short', 'Let the rested person organise'], 'What would help neither person feel guilty?'],
  ['What is your preferred style of morning conversation?', ['A cheerful catch-up', 'Practical plans only', 'Quiet until breakfast', 'It depends on the day'], 'How could someone make your morning easier?'],
  ['A friend suggests a last-minute visit. What would you prefer?', ['Welcome them in', 'Meet outside instead', 'Choose another day', 'Check the mood first'], 'What part would you want to decide together?'],
  ['What would you choose for a screen-free hour?', ['A card or board game', 'A walk', 'Cooking or making something', 'A long conversation'], 'What usually competes for that hour?'],
  ['Which experience would you save for first?', ['A weekend away', 'A concert or show', 'A special meal', 'A class together'], 'What makes that experience worth waiting for?'],
  ['What would you most like to improve in a shared routine?', ['Less rushing', 'More fun', 'Fairer responsibilities', 'More time to rest'], 'What is one small change that could help?'],
  ['Which kind of travel accommodation would you choose?', ['A simple central room', 'A quiet nature stay', 'A place with a kitchen', 'One special night somewhere nice'], 'Which trade-off are you comfortable making?'],
  ['How would you prefer to choose a big purchase together?', ['Research separately, compare', 'Browse and discuss together', 'Agree a budget, delegate', 'Make a shortlist, sleep on it'], 'What information helps you feel ready to decide?'],
  ['What sounds best after a tiring social event?', ['Talk about the evening', 'Get a quiet snack', 'Go straight to sleep', 'Do our own thing briefly'], 'What would help the transition home feel easy?'],
  ['Which kind of little adventure would you pick?', ['A new neighbourhood', 'A recipe neither knows', 'A beginner class', 'A spontaneous day trip'], 'What would make it enjoyable even if it went badly?'],
  ['How would you keep track of shared plans?', ['A shared calendar', 'A regular quick check-in', 'A simple message thread', 'One visible list at home'], 'What tends to fall through the cracks now?'],
  ['What would make a difficult week feel more manageable?', ['Fewer commitments', 'Clear practical help', 'More quiet time together', 'Something small to anticipate'], 'How would you ask for that without expecting mind-reading?'],
  ['What is your favourite way to enjoy a familiar place together?', ['Find a new food spot', 'Revisit a good memory', 'Take a different route', 'Stay longer and slow down'], 'What familiar place comes to mind?'],
  ['What would you choose for the final hour of a good day?', ['A gentle conversation', 'A shared show or book', 'A slow walk', 'An early night'], 'What would you like the day to end feeling like?'],
  ...extraMatches,
]);

// Adapter retains the established questionBank field names for existing games.
// Follow-up prompts replace the old relationship verdicts.
const mature = (items: ConversationPrompt[]) => items.map(item => ({
  soalan: item.question, followUp: item.followUp, mood: item.mood, green_flag: '', red_flag: '',
}));
export const englishQuestionBank = {
  teka_teki_bodoh: englishRiddles,
  vibe_check: englishVibes.map(item => ({ soalan: item.question, soalan_perangkap: item.followUp, mood: item.mood })),
  soalan_matang_prakahwinan: {
    pengurusan_duit_dan_hutang: mature(englishMatureGroups[0]),
    batasan_keluarga_dan_mertua: mature(englishMatureGroups[1]),
    pembahagian_tugas_dan_kerjaya: mature(englishMatureGroups[2]),
    perancangan_zuriat_dan_emosi: mature(englishMatureGroups[3]),
  },
  uncomfortable_topics: englishSensitive.map(item => ({
    soalan: item.question, sebab_penting: item.followUp, mood: item.mood, green_flag: '', red_flag: '',
  })),
  random_deep_questions: englishDeep.map(item => ({ soalan: item.question, tujuan: item.followUp, mood: item.mood })),
  soalan_realiti_pasangan: englishRelationship.map(item => ({ soalan: item.question, tujuan: item.followUp, mood: item.mood })),
  unspoken_rules_malaysia: englishExpectations.map(item => ({ aturan: item.question, huraian: item.followUp, mood: item.mood })),
  bonus_challenges: englishChallenges.map(item => ({ cabaran: item.question, deskripsi: item.followUp, mood: item.mood })),
  teka_hati_dia: englishGuesses.map(item => ({ soalan: item.question, pilihan: item.options, kategori: item.followUp, mood: item.mood })),
  compatibility_match_check: englishMatches.map(item => ({ soalan: item.question, pilihan: item.options, tip_perbincangan: item.followUp, mood: item.mood })),
};

// Every property read by questions.ts is checked here before this bank is used.
// Existing metadata that games never render is intentionally not required.
interface LegacyGameContract {
  teka_teki_bodoh: { soalan: string; jawapan: string }[];
  vibe_check: { soalan: string; soalan_perangkap: string }[];
  soalan_matang_prakahwinan: Record<string, { soalan: string; green_flag: string; red_flag: string }[]>;
  uncomfortable_topics: { soalan: string; sebab_penting: string; green_flag: string; red_flag: string }[];
  random_deep_questions: { soalan: string; tujuan: string }[];
  soalan_realiti_pasangan: { soalan: string; tujuan: string }[];
  unspoken_rules_malaysia: { aturan: string; huraian: string }[];
  bonus_challenges: { cabaran: string; deskripsi: string }[];
  teka_hati_dia: { soalan: string; pilihan: string[]; kategori: string }[];
  compatibility_match_check: { soalan: string; pilihan: string[]; tip_perbincangan: string }[];
}
englishQuestionBank satisfies LegacyGameContract;

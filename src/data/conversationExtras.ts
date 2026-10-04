import type { QuestionMood } from './questionMood';

// Append-only additions, including English takes on themes from the original bank.
export type ConversationRow = [question: string, followUp: string, mood?: QuestionMood];
export type ChoiceRow = [question: string, options: [string, string, string, string], followUp: string, mood?: QuestionMood];

export const extraVibes: ConversationRow[] = [
  ['What is your automatic order at a mamak?', 'Name the drink too.', 'easy'],
  ['What snack would you happily eat every day this week?', 'Sweet, salty, or both?', 'easy'],
  ['What is the last song you played more than once?', 'Which part made you hit replay?', 'easy'],
  ['What is your first move when you get home?', 'Shoes off, food first, or straight to the sofa?', 'easy'],
  ['Which meal tastes better the next day?', 'Do you deliberately save some?', 'easy'],
  ['What is one thing you always have in your bag?', 'Has it ever saved the day?', 'easy'],
  ['What is your favourite time of day to do nothing?', 'Where would you spend it?', 'easy'],
  ['What was the nicest thing you ate this week?', 'Would you order it again?', 'easy'],
  ['Which small thing are you looking forward to tomorrow?', 'It can be as simple as breakfast.', 'easy'],
  ['What smell instantly improves your mood?', 'Where do you usually find it?', 'easy'],
  ['What is your go-to film when you cannot decide what to watch?', 'Do you know any lines by heart?', 'easy'],
  ['What makes you say yes to a last-minute food run?', 'Name the food that could convince you.', 'easy'],
  ['Which household chore deserves its own sports commentary?', 'Give us the opening line.', 'fun'],
  ['If your phone could complain about one of your habits, what would it say?', 'Would the complaint be fair?', 'fun'],
  ['Which animal has your exact energy before breakfast?', 'Make a case for the resemblance.', 'fun'],
  ['What completely ordinary thing would you put on your rider if you were famous?', 'Pick one item you would refuse to perform without.', 'fun'],
  ['You have to rename yourself after the last thing you ate. How bad is it?', 'Could you make it sound like a stage name?', 'fun'],
  ['What would you name a very dramatic pet fish?', 'What is its biggest problem?', 'fun'],
  ['Which errand could become a surprisingly good date?', 'Add one snack stop to the plan.', 'fun'],
  ['What harmless habit would give you away if you were replaced by a lookalike?', 'Who would notice first?', 'fun'],
  ['What would your most useless superpower be?', 'Find one situation where it is suddenly helpful.', 'fun'],
  ['Which fictional character would be a terrible housemate?', 'What would the first house meeting be about?', 'fun'],
  ['If your fridge had a dating profile, what would its bio say?', 'Is it overselling itself?', 'fun'],
  ['What is the pettiest hill you would defend in a friendly debate?', 'Keep it about something like food, films, or how to load a dishwasher.', 'fun'],
];

export const extraDeep: ConversationRow[] = [
  ['What are you still trying to earn that you might already deserve?', 'What would change if you stopped treating it as a reward?', 'deep'],
  ['Which part of your life looks right from the outside but feels wrong to you?', 'What would make it feel more like your own choice?', 'deep'],
  ['If nobody could be disappointed in you, what would you choose differently?', 'Which part of that choice could you try now?', 'deep'],
  ['What have you forgiven someone for, but not yourself?', 'Would you judge a friend by the same standard?', 'deep'],
  ['What do you keep calling a phase even though it has become your life?', 'Do you want to accept it, change it, or give it a little more time?', 'deep'],
  ['Which version of success would you be relieved to stop chasing?', 'What would take its place?', 'deep'],
  ['What is a truth about you that people only learn after knowing you for a while?', 'What makes it hard to see at first?', 'deep'],
  ['When have you confused being needed with being loved?', 'How would you tell the difference now? A hypothetical answer is fine.', 'deep'],
  ['What would you want someone to understand about your silence?', 'Does it mean different things on different days?', 'deep'],
  ['Which memory feels small until you try to explain why it matters?', 'What did that moment give you?', 'deep'],
  ['What did you have to unlearn to become easier on yourself?', 'Where does the old habit still show up?', 'deep'],
  ['What is a life you would admire but would not want to live?', 'What does that tell you about your own priorities?', 'deep'],
  ['What are you afraid would happen if you asked for exactly what you need?', 'What might a manageable first request sound like?', 'deep'],
  ['Which compromise has slowly started to feel like losing yourself?', 'What boundary might help you stay present as yourself?', 'deep'],
  ['What do you want your ordinary days to say about what matters to you?', 'Does the way you spend your time match that?', 'deep'],
  ['What would you do differently if you trusted that you could start over?', 'What is the smallest version of that change?', 'deep'],
  ['Which thing do you miss: the person, the place, or who you were there?', 'You can keep the details private and talk about the feeling.', 'deep'],
  ['What does feeling safe with someone let you do that you usually hold back?', 'How do you notice that safety beginning?', 'deep'],
  ['What has getting older made simpler for you?', 'What has become more complicated?', 'deep'],
  ['What would you hope a future version of you no longer has to prove?', 'Who would you be trying to prove it to today?', 'deep'],
];

export const extraRelationship: ConversationRow[] = [
  ['What is one small favour you would always be happy to do for someone you love?', 'What makes that one easy to say yes to?', 'easy'],
  ['What would you cook for someone on a tired evening?', 'Something very simple counts.', 'easy'],
  ['Which everyday activity is better with company?', 'What makes it better?', 'easy'],
  ['What is your favourite way to say goodnight?', 'A quick message, a call, or something else?', 'easy'],
  ['What small detail tells you someone remembered you?', 'Think of a snack, a song, or a familiar habit.', 'easy'],
  ['What would make a ten-minute catch-up feel good today?', 'Choose one easy thing to talk about.', 'easy'],
  ['What would your imaginary shared cafe be famous for?', 'Pick one menu item and one very specific house rule.', 'fun'],
  ['What ridiculous team name would suit you and someone close to you?', 'What would the team be unexpectedly good at?', 'fun'],
  ['What ordinary errand would you turn into an annual tradition?', 'Give it a slightly too formal name.', 'fun'],
  ['What does loyalty look like when you disagree with someone you love?', 'Where is the line between supporting someone and simply agreeing?', 'deep'],
  ['How would you know a relationship was helping you grow without asking you to become someone else?', 'What part of yourself would you want room to keep?', 'deep'],
  ['Which difference between you and a partner could be healthy, and which would be hard to live with?', 'You can answer about an imaginary future relationship.', 'deep'],
];

export const extraMatureGroups: ConversationRow[][] = [
  [
    ['What is one inexpensive treat you would keep in a shared budget?', 'How often would you want it?', 'easy'],
    ['If your spending habits had a warning label, what would it say?', 'Keep it to a harmless habit you can laugh about.', 'fun'],
    ['What would you do if the wedding you could afford was smaller than the one your family expected?', 'Which expectations would you discuss before spending anything?', 'deep'],
  ],
  [
    ['Which family meal would you like to learn how to make?', 'Who makes it the way you like it?', 'easy'],
    ['What would your family insist on bringing to an imaginary potluck?', 'What dish would disappear first?', 'fun'],
    ['If living with family saved money but cost you privacy, what would make the arrangement workable?', 'What would you want agreed before moving in?', 'deep'],
  ],
  [
    ['Which household job would you happily swap for another?', 'What is your preferred trade?', 'easy'],
    ['Which home task would you give yourself a very official job title for?', 'Write your one-line job description.', 'fun'],
    ['If a dream job meant living apart for a while, what would you need to decide together?', 'Think about a timeline, everyday support, and how to review the plan.', 'deep'],
  ],
  [
    ['Which calming routine would you like to keep in your future home?', 'What would the easiest version look like?', 'easy'],
    ['What harmless house rule would you propose just for fun?', 'Would everyone actually follow it?', 'fun'],
    ['If two people wanted different things about having children, what would an honest conversation need to include?', 'Keep it hypothetical if you prefer. What should neither person feel pressured to promise?', 'deep'],
  ],
];

export const extraGuesses: ChoiceRow[] = [
  ['What is my most likely midnight snack?', ['Instant noodles', 'Roti canai', 'Something sweet', 'Whatever is in the fridge'], 'Which one have I actually chosen recently?', 'easy'],
  ['What drink would I order without looking at the menu?', ['Teh tarik', 'Coffee', 'Something cold and fruity', 'Plain water'], 'Does the answer change with the time of day?', 'easy'],
  ['Which seat am I likely to choose?', ['By the window', 'In a quiet corner', 'Close to the exit', 'Wherever my friends sit'], 'Have you ever noticed me doing this?', 'easy'],
  ['What would I most like to do on a rainy morning?', ['Stay in bed a little longer', 'Make a warm breakfast', 'Read or watch something', 'Go out anyway'], 'What would make that plan even better?', 'easy'],
  ['Which silly competition would bring out my serious side?', ['Naming songs in one second', 'Stacking things neatly', 'Spotting film mistakes', 'Finding the cheapest snack'], 'What would my victory speech sound like?', 'fun'],
  ['What would my role be in a very low-budget heist film?', ['The overprepared planner', 'The charming distraction', 'The accidental genius', 'The one who packed snacks'], 'What is my completely harmless mission?', 'fun'],
  ['Which fake business would I be most tempted to open?', ['A nap cafe', 'An oddly specific museum', 'A snack review hotline', 'A shop for tiny luxuries'], 'Name my first product.', 'fun'],
  ['What would give me away in a disguise?', ['My laugh', 'My usual phrases', 'My food order', 'My walk'], 'Would I last five minutes undercover?', 'fun'],
  ['What do I find hardest to ask someone for?', ['Reassurance', 'Practical help', 'Time alone', 'A second chance'], 'What would help me ask sooner?', 'deep'],
  ['What would help me feel understood during a disagreement?', ['Having my point repeated back', 'Time to finish speaking', 'A calm tone', 'A question about what I need'], 'Which of these is easiest to forget in the moment?', 'deep'],
  ['Which feeling do I tend to hide behind being busy?', ['Uncertainty', 'Disappointment', 'Loneliness', 'Feeling overwhelmed'], 'A hypothetical answer is fine. What kind of check-in would help?', 'deep'],
  ['What would matter most to me in a major life change?', ['Feeling supported', 'Keeping independence', 'Having a clear plan', 'Knowing I can reconsider'], 'What would make that need easier to explain?', 'deep'],
];

export const extraMatches: ChoiceRow[] = [
  ['A late-night food stop is on the table. What are you choosing?', ['Mamak', 'Burgers', 'Something sweet', 'Food at home'], 'What is the order?', 'easy'],
  ['Pick one small treat for an ordinary weekday.', ['A favourite drink', 'A good snack', 'An extra half-hour in bed', 'A short walk somewhere nice'], 'Which one sounds good today?', 'easy'],
  ['Which errand would you most enjoy doing together?', ['Grocery shopping', 'A car wash and coffee', 'Choosing things for home', 'Picking up dinner'], 'What snack stop would you add?', 'easy'],
  ['Choose the background sound for a slow evening.', ['A familiar playlist', 'Rain outside', 'A comfort show', 'Quiet'], 'Would it be the same choice tomorrow?', 'easy'],
  ['Your imaginary team needs a mascot. What are you picking?', ['An overconfident duck', 'A sleepy cat', 'A very organised squirrel', 'A dramatic pigeon'], 'What is its motto?', 'fun'],
  ['You have to enter a talent show together. What is the plan?', ['A deliberately bad dance', 'A convincing fake advert', 'A snack review', 'A dramatic reading of a receipt'], 'How would you divide the roles?', 'fun'],
  ['What would be your first rule as rulers of a tiny island?', ['Mandatory snack breaks', 'No morning meetings', 'Every road has shade', 'Fridays are half-days'], 'Which rule would people actually thank you for?', 'fun'],
  ['Choose a completely unnecessary shared invention.', ['A lost-remote detector', 'A perfectly timed tea bell', 'A queue-place robot', 'A device that folds fitted sheets'], 'Give it a very serious product name.', 'fun'],
  ['Which promise would matter most during a difficult season?', ['We will speak honestly', 'We will share the practical load', 'We will make time to reconnect', 'We will ask for help early'], 'What action would make that promise believable?', 'deep'],
  ['What should stay yours even in a very close relationship?', ['Time for your own friends', 'A personal financial cushion', 'A private creative space', 'Freedom to rethink your plans'], 'What would respecting that look like day to day?', 'deep'],
  ['If your plans for the future changed, what would you want first?', ['Room to explain the change', 'Time to think separately', 'A shared plan for next steps', 'Reassurance about the relationship'], 'What should the other person avoid assuming?', 'deep'],
  ['Which kind of fairness matters most when life is uneven?', ['Sharing according to capacity', 'Checking how each person feels', 'Keeping personal choices open', 'Reviewing responsibilities often'], 'What would you want to revisit when circumstances change?', 'deep'],
];

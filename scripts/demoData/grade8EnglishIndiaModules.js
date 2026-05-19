'use strict';

const {
  SEMESTER,
  COURSE_CODE,
  COURSE_TITLE,
  COURSE_DESCRIPTION,
} = require('./grade8EnglishIndiaConstants');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {[string,string][]} rows */
function table(head, rows) {
  const th = head.map((h) => `<th>${esc(h)}</th>`).join('');
  const tr = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="min-w-full border border-gray-300 dark:border-gray-600 my-4"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

const SYLLABUS_HTML = `<h2>English 8 — Spring 2026</h2><p><strong>Instructor:</strong> Ms Ananya Rao &nbsp;|&nbsp; <strong>Term:</strong> ${esc(
  SEMESTER.term
)} ${SEMESTER.year} &nbsp;|&nbsp; <strong>Course code:</strong> <code>${esc(COURSE_CODE)}</code></p><h3>Purpose</h3><p>This course strengthens reading, writing, listening, and speaking for real school tasks: unseen passages, grammar in context, poetry appreciation, short literature study, and structured compositions aligned with Indian middle-school English expectations.</p><h3>Weekly rhythm</h3><ol><li><strong>Read</strong> — module pages (models, examples, mentor texts).</li><li><strong>Discuss</strong> — graded discussion with a precise prompt.</li><li><strong>Write</strong> — weekly homework (process + revision).</li><li><strong>Check</strong> — short quiz (mixed item types).</li></ol><h3>Assessment weights (gradebook categories)</h3>${table(
  ['Category', 'Weight'],
  [
    ['Weekly homework &amp; process writing', '22%'],
    ['Quizzes &amp; checkpoint tasks', '24%'],
    ['Projects &amp; presentations', '15%'],
    ['Discussions &amp; seminar participation', '14%'],
    ['Semester examination', '18%'],
    ['Portfolio &amp; reflection', '7%'],
  ]
)}<h3>Materials</h3><ul><li>One durable notebook for grammar drills and vocabulary logs.</li><li>A ring binder for printed mentor texts (also available as PDFs in the course).</li><li>Access to a quiet space for weekly audio-response practice (optional).</li></ul><h3>Academic integrity</h3><p>Use your own words; cite any phrase borrowed from the web. AI drafting is <strong>not</strong> permitted for graded writing unless a task explicitly invites “guided revision with teacher-approved tools.”</p><h3>Communication</h3><p>Post logistics questions in the course discussion pinned thread; send private messages for personal matters. I reply within one school day on weekdays.</p>`;

/** @typedef {{ stem: string, choices: string[], correct: number, points?: number }} McItem */

/**
 * @typedef {{
 *   title: string,
 *   description: string,
 *   pages: { title: string, html: string }[],
 *   homework: { title: string, description: string, questions: object[] },
 *   quizQuestions: object[],
 * }} ModuleSpec
 */

/** @type {ModuleSpec[]} */
const MODULE_SPECS = [];

function addModule(m) {
  MODULE_SPECS.push(m);
}

/** Original mentor passage (not taken from published textbooks). */
const PASSAGE_MONSOON = `<p class="lead">The first true monsoon morning arrived without drama. The sky simply changed its mind: from stubborn white to a patient, bruised grey. On the balcony, Aarav balanced his tea on the railing and watched the lane below turn glossy in minutes. Rickshaw drivers tugged plastic sheets over their knees; children appeared with paper boats already folding themselves in impatient fingers.</p><p>Inside the flat, his grandmother moved pots—rosemary, mint, stubborn chilli—closer to the wall. “Wind first,” she said, as if the weather were a relative whose habits she had memorised. When the rain began, it did not ask permission. It drummed the windows, rinsed the dust off every leaf, and turned the city’s noise into a softer, crowded hush.</p><p>By evening the storm had passed, leaving behind a rinsed clarity. The air tasted of iron and wet earth. Aarav wrote in his journal—not a summary, but a single sentence he could defend in class: <em>The monsoon does not decorate the city; it reveals it.</em></p>`;

const WEEKS = [
  {
    n: 1,
    theme: 'Orientation, habits & classroom English',
    description:
      'Setting goals, active reading habits, and respectful academic discussion — foundation week for the whole semester.',
    pages: [
      {
        title: 'How we read in Grade 8',
        html: `<h2>Active reading (not “skimming for keywords”)</h2><p>In secondary English, reading is a craft. You annotate lightly, ask questions in the margins, and return to confusing lines instead of pretending you understood them.</p><h3>A practical routine</h3><ol><li><strong>Preview</strong> — title, subheadings, first and last paragraph.</li><li><strong>Map</strong> — who is speaking? where? what changes from paragraph to paragraph?</li><li><strong>Challenge</strong> — find one sentence you can defend as “important” with two reasons.</li></ol><blockquote><p><strong>Try now:</strong> In the mentor passage for Week 2, underline one detail that signals social class without naming money directly.</p></blockquote>`,
      },
      {
        title: 'Discussion norms & academic tone',
        html: `<h2>We disagree with ideas, not people</h2><p>Useful phrases: “I read this differently because…”, “Another interpretation could be…”, “Can you point to the line that supports that?”</p><h3>Quality over quantity</h3><p>A strong post references the text, uses precise vocabulary, and invites response. Avoid empty praise (“nice post”) unless you add a specific reason.</p>${table(
          ['Weak comment', 'Stronger comment'],
          [
            ['“I agree.”', '“I agree, especially where the author slows the pace in paragraph 3—does that show hesitation?”'],
            ['“It was good.”', '“The metaphor is effective because it connects weather to family habits.”'],
          ]
        )}`,
      },
      {
        title: 'Portfolio & reflection (semester-long)',
        html: `<h2>Your evidence of growth</h2><p>Each month you will upload one polished piece and write a 150-word reflection: what changed in your drafting process, what you still want to improve, and one goal supported by a concrete action.</p><h3>Why teachers ask for reflection</h3><p>We are not checking whether you “like English.” We are checking whether you can <em>observe your own thinking</em>—a skill that improves every other subject too.</p>`,
      },
    ],
    homework: {
      title: 'Week 1 — Reading contract & letter to self',
      description: `<p><strong>Rubric (10 points)</strong></p><ul><li>Clear goal + realistic habit (4)</li><li>Two specific strategies from the module pages (3)</li><li>Edited for spelling and complete sentences (3)</li></ul>`,
      questions: [
        {
          id: 'w1q1',
          type: 'text',
          text: 'In 120–180 words, describe one reading habit you will change this semester and how you will track it weekly.',
          points: 5,
        },
        {
          id: 'w1q2',
          type: 'text',
          text: 'List three “discussion norms” you personally find difficult. For each, write one sentence you can use instead of a vague reaction.',
          points: 5,
        },
      ],
    },
    quizMc: [
      { stem: 'Which behaviour best matches “academic tone” in discussions?', choices: ['Personal insults to make a point', 'Referencing the text and asking precise questions', 'One-word answers to save time', 'Copy-pasting from websites without context'], correct: 1 },
      { stem: '“Preview” reading includes:', choices: ['Only reading the last paragraph', 'Title, subheadings, first and last paragraph', 'Skipping headings to avoid spoilers', 'Reading aloud only'], correct: 1 },
      { stem: 'A portfolio reflection should mainly:', choices: ['List movies you watched', 'Describe process, evidence, and next steps', 'Repeat the teacher’s slides', 'Argue for higher marks'], correct: 1 },
    ],
    match: {
      text: 'Match the reading move to its purpose.',
      points: 4,
      pairs: [
        ['Annotate', 'Slow down and mark confusing lines'],
        ['Map', 'Track speakers, setting, and shifts'],
        ['Challenge', 'Defend an interpretive claim with reasons'],
      ],
    },
    shortQuiz: { text: 'In one sentence, state one difference between summary and analysis.', points: 3 },
  },
  {
    n: 2,
    theme: 'Comprehension — inference & tone',
    description: 'Unseen prose: noticing what the text implies, how setting shapes mood, and how to support answers with evidence.',
    pages: [
      {
        title: 'Mentor text — monsoon morning',
        html: `<h2>Read like a writer</h2>${PASSAGE_MONSOON}<h3>Guided questions (do not submit answers here)</h3><ul><li>What contrasts does the opening set up between “without drama” and what follows?</li><li>How does the grandmother treat weather—and what does that suggest about her personality?</li><li>Why might the author end with a single sentence for Aarav rather than a full paragraph?</li></ul>`,
      },
      {
        title: 'Inference vs assumption',
        html: `<h2>Evidence-bound inference</h2><p>An <strong>inference</strong> is a reasonable claim the text pushes you toward, and you can point to multiple details that increase its likelihood. An <strong>assumption</strong> imports outside facts the text never signals.</p><blockquote><p>Example inference: “The household values plants and preparedness.” Evidence: moving pots; grandmother’s spoken habit about wind.</p><p>Example assumption: “Aarav failed his exams.” The passage never discusses school marks.</p></blockquote>`,
      },
      {
        title: 'Tone and word choice',
        html: `<h2>Tone is the author’s attitude</h2><p>Words like “patient,” “bruised,” “stubborn,” and “rinsed” colour the sky and city with personality. When you answer “What is the tone?” defend it with two word choices and their connotations.</p>`,
      },
    ],
    homework: {
      title: 'Week 2 — Comprehension response',
      description: `<p>Write in full sentences. Each answer should include at least one short quoted phrase from the mentor text.</p><p><strong>Rubric (20 points)</strong></p><ul><li>Evidence selection (8)</li><li>Inference control — no wild assumptions (6)</li><li>Clarity and grammar (6)</li></ul>`,
      questions: [
        { id: 'w2a', type: 'text', text: 'What does the monsoon “reveal” about the city, in your own words? Support with two details.', points: 7 },
        { id: 'w2b', type: 'text', text: 'Describe the grandmother’s relationship to weather using two actions and one line of dialogue.', points: 7 },
        { id: 'w2c', type: 'text', text: 'Find one example of personification. Explain what human trait is transferred to a non-human thing.', points: 6 },
      ],
    },
    quizMc: [
      { stem: 'An inference must be:', choices: ['Anything you guess', 'Supported by textual details', 'Copied from the internet', 'The same as a summary'], correct: 1 },
      { stem: 'Tone refers to:', choices: ['Only plot events', 'The author’s attitude suggested by language', 'The font size', 'The number of paragraphs'], correct: 1 },
      { stem: 'Personification means:', choices: ['Comparing using like/as', 'Giving human qualities to non-human things', 'Repeating consonants', 'Ending lines with rhyme'], correct: 1 },
    ],
    match: {
      text: 'Match the term to the best gloss.',
      points: 3,
      pairs: [
        ['Inference', 'A text-backed reasonable claim'],
        ['Assumption', 'An unstated outside claim not grounded in the passage'],
        ['Tone', 'Attitude carried by diction and imagery'],
      ],
    },
    shortQuiz: { text: 'One sentence: name the tone of the mentor passage and one word that supports it.', points: 3 },
  },
  {
    n: 3,
    theme: 'Grammar — determiners, articles & quantity',
    description: 'Using a/an/the, demonstratives, and quantifiers with countable/uncountable nouns in formal writing.',
    pages: [
      {
        title: 'Articles in real sentences',
        html: `<h2>Why “the” feels heavier than “a”</h2><p><strong>A/an</strong> introduces; <strong>the</strong> points back to shared knowledge or a specific instance already activated in context.</p>${table(
          ['Context', 'Choice'],
          [
            ['First mention', '“She adopted <em>a</em> dog.”'],
            ['Known to both speaker and listener', '“Close <em>the</em> window.”'],
            ['Unique referent', '“<em>The</em> Principal called an assembly.”'],
          ]
        )}<h3>Common Class 8 errors</h3><ul><li>Missing article before singular countable noun: ❌ “She is teacher.” ✅ “She is <em>a</em> teacher.”</li><li>Over-using “the” for general plural truths: often zero article (“Students need sleep”) unless you mean a specific set.</li></ul>`,
      },
      {
        title: 'Determiners & quantity words',
        html: `<h2>Much/many, little/few, less/fewer</h2><p><strong>Much/little</strong> lean toward uncountable bases; <strong>many/few</strong> toward countable plural nouns. In formal writing, “fewer than ten <em>errors</em>” beats “less errors.”</p><blockquote><p><strong>Mini-drill:</strong> Choose: “How ___ homework is left?” vs “How ___ worksheets are left?”</p></blockquote>`,
      },
      {
        title: 'Apply: formal notice skeleton',
        html: `<h2>School notice — tone + grammar</h2><p>Notices use passive voice sparingly, complete sentences, and precise dates. Articles appear in predictable slots: “<em>The</em> Annual Day rehearsal…”</p>`,
      },
    ],
    homework: {
      title: 'Week 3 — Grammar in context',
      description: `<p><strong>Rubric (18 points)</strong>: rule explanation (6), application (8), editing (4).</p>`,
      questions: [
        { id: 'w3a', type: 'text', text: 'Write five sentences about your school morning. Use a/an/the correctly each time (underline the article only in your final draft line).', points: 8 },
        { id: 'w3b', type: 'text', text: 'Explain in 3–4 sentences when you would choose “fewer” instead of “less,” with your own example.', points: 5 },
        { id: 'w3c', type: 'text', text: 'Fix this: “She gave me advices about the competition.” Explain the grammar rule.', points: 5 },
      ],
    },
    quizMc: [
      { stem: 'Choose the best sentence:', choices: ['She is teacher.', 'She is a teacher.', 'She is the teacher of universe.', 'She is an teacher.'], correct: 1 },
      { stem: 'Which is standard for countable plural?', choices: ['less mistakes', 'fewer mistakes', 'much mistakes', 'little mistakes'], correct: 1 },
      { stem: '“Close the window” uses “the” because:', choices: ['Windows are always unique in English', 'The window is specific in context', 'Random rule', 'Proper noun'], correct: 1 },
    ],
    match: {
      text: 'Match determiner class to example slot.',
      points: 4,
      pairs: [
        ['Article', 'a / an / the'],
        ['Demonstrative', 'this / that / these / those'],
        ['Quantifier', 'some / several / enough'],
      ],
    },
    shortQuiz: { text: 'Rewrite: “I need an advice” — correct form + one-line reason.', points: 3 },
  },
  {
    n: 4,
    theme: 'Vocabulary — word families & register',
    description: 'Building precise verbs, nominalisations (careful use), and shifting between formal/informal register.',
    pages: [
      {
        title: 'Word families',
        html: `<h2>From “decide” to “decisive”</h2><p>Knowing suffix patterns helps you guess meaning and spell better: <em>decide → decision → decisive → indecisive</em>.</p>`,
      },
      {
        title: 'Register — classroom vs chat message',
        html: `<h2>Same idea, different audience</h2>${table(
          ['Informal', 'More formal for school writing'],
          [
            ['“Kids gotta sleep.”', '“Adolescents require adequate sleep.”'],
            ['“Stuff happens.”', '“Unexpected events occurred.”'],
          ]
        )}<p>Formal does not mean fake. It means <strong>controlled</strong>: complete sentences, precise verbs, fewer vague intensifiers (“very”, “really”).</p>`,
      },
      {
        title: 'Collocations for essays',
        html: `<h2>Natural pairs examiners notice</h2><ul><li>raise awareness / take measures / address a problem</li><li>draw a conclusion / provide evidence / maintain focus</li></ul>`,
      },
    ],
    homework: {
      title: 'Week 4 — Vocabulary log & rewrite',
      description: `<p>Create a log of <strong>eight</strong> new collocations from this week’s pages. Then rewrite a short informal paragraph (provided in class) into a formal register.</p><p><strong>Rubric (20)</strong>: accuracy of collocations (8), rewrite control (8), presentation (4).</p>`,
      questions: [
        { id: 'w4a', type: 'text', text: 'List 8 collocations with a one-line example sentence each.', points: 10 },
        { id: 'w4b', type: 'text', text: 'Rewrite (80–100 words): “Kids these days scroll reels whole night then they cant focus in class its bad.” Make it formal without changing the basic claim.', points: 10 },
      ],
    },
    quizMc: [
      { stem: 'Collocation means:', choices: ['Random synonyms', 'Words that naturally co-occur', 'Rhyming endings', 'Opposite meanings'], correct: 1 },
      { stem: 'Which is more formal?', choices: ['“Lots of issues”', '“Several significant issues”', '“Mega problems”', '“Stuff”'], correct: 1 },
      { stem: 'A word family helps you:', choices: ['Avoid reading', 'Predict meaning and spelling from affixes', 'Skip dictionary use entirely', 'Ignore grammar'], correct: 1 },
    ],
    match: {
      text: 'Match base verb to a related abstract noun (acceptable school register).',
      points: 3,
      pairs: [
        ['decide', 'decision'],
        ['analyze', 'analysis'],
        ['conclude', 'conclusion'],
      ],
    },
    shortQuiz: { text: 'Give one formal replacement for the vague intensifier “very” (e.g. very tired → …).', points: 3 },
  },
  {
    n: 5,
    theme: 'Poetry — imagery, rhyme & figurative language',
    description: 'Reading poems as crafted speech: sound, image, and compressed meaning.',
    pages: [
      {
        title: 'Original poem — “Kitchen Constellations”',
        html: `<h2>Mentor poem</h2><pre style="font-family: Georgia, serif; line-height:1.7;">
The gas flame ticks its thin blue yes,
and onions soften into translucence.
Mother salts the story of her day:
names, timings, small mercies.

Outside, the lane invents its constellations—
scooters, kites, a vendor’s bell—
each point of light a argument with darkness.

I stir the pot the way she taught me:
slow figure eights, as if patience
could be dissolved into flavour.
        </pre><p><strong>Notice:</strong> enjambment, domestic imagery, and the metaphor comparing street lights to stars without saying “like.”</p>`,
      },
      {
        title: 'Sound devices (light touch for Class 8)',
        html: `<h2>Rhyme, rhythm, alliteration</h2><p>You do not need fancy jargon to hear craft. Ask: <em>What repeats? What speeds up or slows down?</em></p>`,
      },
      {
        title: 'Figurative language toolkit',
        html: `<h2>Metaphor, simile, personification</h2><ul><li><strong>Simile</strong> uses <em>like/as</em>.</li><li><strong>Metaphor</strong> merges domains without a flag.</li><li><strong>Personification</strong> gives human traits to objects.</li></ul>`,
      },
    ],
    homework: {
      title: 'Week 5 — Poetry response & imitation',
      description: `<p><strong>Rubric (22)</strong>: close reading (10), original imitation (10), conventions (2).</p>`,
      questions: [
        { id: 'w5a', type: 'text', text: 'In 120–160 words, explain how the poem creates a sense of “light vs darkness” without a moral speech.', points: 8 },
        { id: 'w5b', type: 'text', text: 'Write 8–12 lines imitating the domestic + street contrast. Use at least one metaphor and one clear image of sound.', points: 10 },
        { id: 'w5c', type: 'text', text: 'Find one line break that changes meaning if moved. Explain.', points: 4 },
      ],
    },
    quizMc: [
      { stem: '“Time is a thief” is:', choices: ['Simile', 'Metaphor', 'Alliteration', 'Onomatopoeia'], correct: 1 },
      { stem: 'Enjambment means:', choices: ['Rhyming the last words', 'A line continues without pause into the next line', 'Counting syllables', 'Repeating vowels'], correct: 1 },
      { stem: 'Personification:', choices: ['Compares using like/as', 'Gives human traits to non-human things', 'Repeats consonants at line start', 'Lists synonyms'], correct: 1 },
    ],
    match: {
      text: 'Match device to example pattern.',
      points: 4,
      pairs: [
        ['Simile', 'Uses like or as'],
        ['Metaphor', 'Implied comparison without like/as'],
        ['Alliteration', 'Repeated consonant sounds at word starts'],
      ],
    },
    shortQuiz: { text: 'Name one image from “Kitchen Constellations” that appeals to more than one sense.', points: 3 },
  },
  {
    n: 6,
    theme: 'Writing — narrative voice & dialogue',
    description: 'Short scene writing: balancing narration, dialogue tags, and character voice.',
    pages: [
      {
        title: 'Scene blueprint',
        html: `<h2>Goal → obstacle → choice</h2><p>Even a two-page school narrative needs a <em>turn</em>: someone wants something, something blocks it, a choice reveals character.</p>`,
      },
      {
        title: 'Dialogue mechanics',
        html: `<h2>Tags and beats</h2><p>Alternate speech with small actions (“beats”) to avoid a tennis match of talking heads. Vary said-bookisms carefully— “said” is often invisible and therefore strong.</p>`,
      },
      {
        title: 'Mini-project launch — book spine poetry',
        html: `<h2>Creative constraint</h2><p>Stack 4–6 book titles so their spines form a poem. Photograph (or sketch) the spines and write a 100-word artist statement explaining your theme. This counts toward your <strong>Projects</strong> category.</p>`,
      },
    ],
    homework: {
      title: 'Week 6 — Narrative scene (draft A)',
      description: `<p>250–320 words. Include at least six lines of dialogue and two beats.</p><p><strong>Rubric (24)</strong>: structure (8), voice (8), mechanics (8).</p>`,
      questions: [
        { id: 'w6a', type: 'text', text: 'Paste your scene (250–320 words).', points: 16 },
        { id: 'w6b', type: 'text', text: 'One paragraph reflection: what was hardest about dialogue tags, and what will you revise in draft B?', points: 8 },
      ],
    },
    quizMc: [
      { stem: 'A “beat” in dialogue usually means:', choices: ['A drum solo', 'A small action interleaved with speech', 'A chapter title', 'A grammar mistake'], correct: 1 },
      { stem: 'A scene “turn” is:', choices: ['Only description', 'A shift that reveals character or outcome', 'The font choice', 'The first sentence only'], correct: 1 },
      { stem: 'Which is usually cleanest for school narratives?', choices: ['Only synonyms for “said”', 'Mostly “said” + clear beats', 'No dialogue', 'All exclamation marks'], correct: 1 },
    ],
    match: {
      text: 'Match story element to question it answers.',
      points: 3,
      pairs: [
        ['Goal', 'What does the character want?'],
        ['Obstacle', 'What blocks the want?'],
        ['Choice', 'What decision shows values?'],
      ],
    },
    shortQuiz: { text: 'Write one line of dialogue + one beat (no more than 35 words total).', points: 3 },
  },
  {
    n: 7,
    theme: 'Functional writing — formal letter to authority',
    description: 'Layout, tone, and persuasion: letter to the municipal councillor about a local issue.',
    pages: [
      {
        title: 'Formal letter skeleton (CBSE-friendly)',
        html: `<h2>Block layout</h2><ol><li>Sender address (short)</li><li>Date</li><li>Receiver address + respectful salutation</li><li>Subject line</li><li>Body paragraphs: purpose → details → courteous close</li><li>Yours faithfully/sincerely</li></ol>`,
      },
      {
        title: 'Persuasion without melodrama',
        html: `<h2>Evidence + request</h2><p>Strong civic letters pair observable facts (“broken footpath outside Gate B since November”) with a <strong>reasonable request</strong> (“please schedule repairs before monsoon”).</p>`,
      },
      {
        title: 'Tone pitfalls',
        html: `<h2>Avoid</h2><ul><li>ALL CAPS anger</li><li>Vague threats</li><li>Anonymous rumours stated as fact</li></ul><h2>Prefer</h2><ul><li>Measured verbs: <em>request, recommend, seek clarification</em></li></ul>`,
      },
    ],
    homework: {
      title: 'Week 7 — Formal letter (full)',
      description: `<p>Choose a realistic local issue (traffic, waste, park maintenance, library hours). 180–220 words excluding addresses.</p><p><strong>Rubric (25)</strong>: format (7), tone (8), argument (10).</p>`,
      questions: [
        { id: 'w7a', type: 'text', text: 'Paste your complete letter including subject line and salutation.', points: 18 },
        { id: 'w7b', type: 'text', text: 'Explain one sentence you softened to sound more respectful. Quote before/after.', points: 7 },
      ],
    },
    quizMc: [
      { stem: 'A subject line should:', choices: ['Be cute and vague', 'State purpose in a phrase', 'Be written in all capitals only', 'Be omitted'], correct: 1 },
      { stem: '“Yours faithfully” often pairs with:', choices: ['Dear Sir/Madam (unknown name)', 'Dear Ms Sharma (known name)', 'Hi team', 'Hey councillor'], correct: 0 },
      { stem: 'Strong civic letters prioritize:', choices: ['Insults', 'Observable detail + reasonable request', 'Gossip', 'Poetry only'], correct: 1 },
    ],
    match: {
      text: 'Match letter part to function.',
      points: 4,
      pairs: [
        ['Opening paragraph', 'State purpose clearly'],
        ['Body', 'Support with specifics'],
        ['Close', 'Courteous expectation / thanks'],
      ],
    },
    shortQuiz: { text: 'Write a subject line for a letter about unsafe pedestrian crossing near your school (max 15 words).', points: 3 },
  },
  {
    n: 8,
    theme: 'Grammar — reported speech',
    description: 'Backshifting, reporting verbs, and preserving meaning when converting dialogue to indirect speech.',
    pages: [
      {
        title: 'Rules with sense',
        html: `<h2>When backshift “feels” optional</h2><p>If the reported fact is still true, some registers keep present tense: “She said she <em>likes</em> chess.” But exam tasks often prefer systematic backshift—read the question rubric.</p>`,
      },
      {
        title: 'Reporting verbs beyond “said”',
        html: `<h2>Nuance</h2>${table(
          ['Verb', 'Shade of meaning'],
          [
            ['admit', 'confess reluctantly'],
            ['deny', 'reject a claim'],
            ['urge', 'push for action'],
            ['claim', 'assert without proof offered in the clause'],
          ]
        )}`,
      },
      {
        title: 'Pronoun & time-word shifts',
        html: `<h2>Micro-editing</h2><p>today → that day; tomorrow → the next day; here → there — but only when the deictic centre moves with the reporter.</p>`,
      },
    ],
    homework: {
      title: 'Week 8 — Reported speech transformations',
      description: `<p><strong>Rubric (18)</strong>: accuracy (10), meaning preserved (5), punctuation (3).</p>`,
      questions: [
        { id: 'w8a', type: 'text', text: 'Direct: She said, “I will submit the draft tonight.” → Indirect (two acceptable variants; explain your tense choice in one sentence).', points: 6 },
        { id: 'w8b', type: 'text', text: 'Direct: “Why are you late?” the coach asked. → Indirect question form.', points: 6 },
        { id: 'w8c', type: 'text', text: 'Rewrite five sentences from a news interview (provided in class PDF) into a reported paragraph.', points: 6 },
      ],
    },
    quizMc: [
      { stem: 'Indirect questions usually:', choices: ['Keep question word order like direct questions', 'Use statement word order after if/whether or wh-word', 'Always end with ?', 'Remove all verbs'], correct: 1 },
      { stem: '“He said he is tired” may be acceptable when:', choices: ['Never', 'The state is still true (some registers)', 'Only in Old English', 'Only for commands'], correct: 1 },
      { stem: '“Deny” reports:', choices: ['A greeting', 'A rejection of a claim', 'A weather forecast', 'A poem'], correct: 1 },
    ],
    match: {
      text: 'Match direct time word to common backshift.',
      points: 3,
      pairs: [
        ['today', 'that day'],
        ['tomorrow', 'the next day / the following day'],
        ['now', 'then'],
      ],
    },
    shortQuiz: { text: 'Convert to indirect: He said, “I finished the diagram.” (one sentence).', points: 3 },
  },
  {
    n: 9,
    theme: 'Essay writing — thesis, outline & cohesion',
    description: 'Argumentative essay skills: controlling idea, paragraph unity, transitions, and counter-addressing.',
    pages: [
      {
        title: 'Thesis vs topic sentence',
        html: `<h2>Thesis for the whole essay</h2><p>A thesis answers the prompt and forecasts your reasons. Topic sentences start paragraphs and link back to the thesis like spokes.</p>`,
      },
      {
        title: 'PEEL without robot voice',
        html: `<h2>Point — Evidence — Explanation — Link</h2><p>Use the pattern as a <em>checklist</em>, not a mechanical label parade (“Point: … Evidence: …”).</p>`,
      },
      {
        title: 'Counterargument (brief)',
        html: `<h2>Fairness signals maturity</h2><p>Spend a short paragraph acknowledging a plausible objection, then answer it with evidence. Avoid straw opponents.</p>`,
      },
    ],
    homework: {
      title: 'Week 9 — Argumentative essay (600–700 words)',
      description: `<p>Prompt: <strong>Should mobile phones be completely banned during school hours for Class 8–10? Why or why not?</strong></p><p><strong>Rubric (30)</strong>: thesis &amp; organisation (10), evidence (12), language (8).</p>`,
      questions: [
        { id: 'w9a', type: 'text', text: 'Paste thesis + outline (bullets) before the essay.', points: 6 },
        { id: 'w9b', type: 'text', text: 'Paste full essay (600–700 words).', points: 20 },
        { id: 'w9c', type: 'text', text: 'One paragraph: what counterargument did you include, and how did you answer it?', points: 4 },
      ],
    },
    quizMc: [
      { stem: 'A thesis should be:', choices: ['A fact only', 'A contestable claim aligned to the prompt', 'A question', 'A quote'], correct: 1 },
      { stem: 'A straw opponent is:', choices: ['A strong rival argument', 'A weak or fake version of an objection', 'A citation', 'A transition word'], correct: 1 },
      { stem: 'Cohesion includes:', choices: ['Random topic jumps', 'Logical transitions and reference chains', 'Only spelling', 'Only long words'], correct: 1 },
    ],
    match: {
      text: 'Match essay move to purpose.',
      points: 4,
      pairs: [
        ['Introduction', 'Frame issue + thesis'],
        ['Body paragraph', 'Develop one main reason'],
        ['Conclusion', 'Synthesise without introducing brand-new claims'],
      ],
    },
    shortQuiz: { text: 'Write one thesis sentence for the Week 9 prompt (max 35 words).', points: 3 },
  },
  {
    n: 10,
    theme: 'Literature — theme, symbol & discussion',
      description: 'Short prose study: tracking motifs, ethical dilemmas, and evidence-based interpretation.',
    pages: [
      {
        title: 'Original micro-story — “The Extra Ticket”',
        html: `<h2>Mentor text</h2><p>At the science centre, Isha counted heads twice. Four classmates, one teacher, one parent volunteer—and only five tickets because the printer had jammed. The sixth ticket would arrive by courier “before noon,” the desk clerk promised, which meant nothing when the doors opened at ten.</p><p>Ravi wanted to go in immediately; Leela wanted to wait; the parent volunteer suggested splitting the group. Isha stared at the QR code on her phone as if it could split like a cell. The ethical knot was small only if you believed small knots do not matter.</p><p>By ten-fifteen they had decided something imperfect but fair. The story does not tell you who went first; it ends with Isha’s sentence in the group chat: <em>We did not solve the system. We solved us.</em></p>`,
      },
      {
        title: 'Theme vs moral lesson',
        html: `<h2>Theme is broader</h2><p>A moral can sound like advice. A theme states what the story explores: fairness, institutions vs people, trust under pressure.</p>`,
      },
      {
        title: 'Symbols and motifs',
        html: `<h2>Repetition with variation</h2><p>If tickets, phones, and doors recur, ask what each <em>does</em> at different moments—not what they “symbolise” in a dictionary sense.</p>`,
      },
    ],
    homework: {
      title: 'Week 10 — Literature response',
      description: `<p><strong>Rubric (22)</strong>: interpretation (10), evidence (8), writing (4).</p>`,
      questions: [
        { id: 'w10a', type: 'text', text: 'What theme does “The Extra Ticket” explore? Defend with three details.', points: 10 },
        { id: 'w10b', type: 'text', text: 'Who changes most—Isha, Ravi, or Leela? Argue with two quoted phrases (max 12 words each).', points: 8 },
        { id: 'w10c', type: 'text', text: 'Write one discussion question you would ask a partner about the ending line.', points: 4 },
      ],
    },
    quizMc: [
      { stem: 'A motif is:', choices: ['A spelling mistake', 'A recurring element that can gather meaning', 'Only dialogue', 'The title only'], correct: 1 },
      { stem: 'Theme differs from plot because:', choices: ['Theme is the sequence of events', 'Theme is what the story explores beyond “what happens”', 'Theme is always a moral command', 'Theme is the setting only'], correct: 1 },
      { stem: 'Strong literature answers:', choices: ['Avoid quotes', 'Ground claims in textual evidence', 'Invent scenes not in the text', 'Use only biography of author'], correct: 1 },
    ],
    match: {
      text: 'Match concept to question.',
      points: 3,
      pairs: [
        ['Plot', 'What happens, in order'],
        ['Character', 'Who desires, fears, chooses'],
        ['Setting', 'Where and when conditions apply'],
      ],
    },
    shortQuiz: { text: 'One sentence: what does the QR code “do” in the story emotionally, not technically?', points: 3 },
  },
  {
    n: 11,
    theme: 'Reading analysis — point of view & reliability',
    description: 'First vs third person, limited vs omniscient narration, and cautious claims about narrators.',
    pages: [
      {
        title: 'Who sees? Who knows?',
        html: `<h2>Limited third person</h2><p>The narrator follows one consciousness closely. You cannot assert another character’s hidden thoughts unless the text gives clear outward signs.</p>`,
      },
      {
        title: 'Unreliable narration (introduction)',
        html: `<h2>Not “liar” — filtered</h2><p>A narrator can be sincere yet partial. Your job is to notice gaps between what is said and what is shown.</p>`,
      },
      {
        title: 'Practice lens for exam passages',
        html: `<h2>Three quick questions</h2><ol><li>Whose pronouns anchor the passage?</li><li>What can this narrator <em>not</em> know?</li><li>Where does the text invite doubt?</li></ol>`,
      },
    ],
    homework: {
      title: 'Week 11 — Narrative perspective analysis',
      description: `<p>Use any one story from Weeks 6–10 modules or your own reader notebook entry approved by the teacher.</p><p><strong>Rubric (20)</strong>.</p>`,
      questions: [
        { id: 'w11a', type: 'text', text: 'Identify POV (1st/3rd; limited/omniscient if 3rd). Support with two examples.', points: 8 },
        { id: 'w11b', type: 'text', text: 'What does this POV choice help the reader feel? (120–160 words)', points: 8 },
        { id: 'w11c', type: 'text', text: 'Name one limitation of this narrator’s knowledge and how it affects interpretation.', points: 4 },
      ],
    },
    quizMc: [
      { stem: 'Limited third person means:', choices: ['The narrator knows all thoughts everywhere', 'The narration clings closely to selected consciousness', 'Only dialogue exists', 'The reader writes the story'], correct: 1 },
      { stem: 'Omniscient narration can:', choices: ['Never describe feelings', 'Move between minds or provide wide information', 'Only use “I”', 'Never use past tense'], correct: 1 },
      { stem: 'Unreliable narration always means:', choices: ['The narrator is evil', 'The narrator may be partial or misleading', 'The story is false', 'There is no setting'], correct: 1 },
    ],
    match: {
      text: 'Match pronoun anchor to common POV.',
      points: 3,
      pairs: [
        ['I / we dominant', 'First person'],
        ['He / she / they with interior access to one mind', 'Third limited (typical)'],
        ['He / she with broad access', 'Third omniscient (broad)'],
      ],
    },
    shortQuiz: { text: 'Why must you be cautious claiming another character’s thoughts in limited third POV?', points: 3 },
  },
  {
    n: 12,
    theme: 'Revision, examination genre & editing',
    description: 'Synthesis week: error hunt, time management, and genre features of semester exam tasks.',
    pages: [
      {
        title: 'Error archaeology',
        html: `<h2>Find patterns, not random typos</h2><p>Keep a personal “Top 5 errors” list: articles, tense consistency, comma splices, spelling confusions (their/there), paragraph unity.</p>`,
      },
      {
        title: 'Exam section timing (sample)',
        html: `${table(
          ['Section', 'Suggested minutes', 'Focus'],
          [
            ['Reading comprehension', '35', 'Annotate lightly first'],
            ['Grammar & short items', '20', 'Rule → example'],
            ['Writing task', '40', 'Plan 5 minutes'],
            ['Review', '10', 'Fix clear errors only'],
          ]
        )}`,
      },
      {
        title: 'Semester reflection',
        html: `<h2>Metacognition</h2><p>List three competencies you improved and one you will carry into Grade 9 with a reading plan.</p>`,
      },
    ],
    homework: {
      title: 'Week 12 — Revision portfolio letter',
      description: `<p><strong>Rubric (16)</strong>.</p>`,
      questions: [
        { id: 'w12a', type: 'text', text: 'Write a 200–250 word letter to next semester’s you: strengths, gaps, and three habits to keep.', points: 10 },
        { id: 'w12b', type: 'text', text: 'Paste your Top 5 error list with one corrected example each.', points: 6 },
      ],
    },
    quizMc: [
      { stem: 'During timed writing, first minutes should often go to:', choices: ['Random doodling', 'A short plan aligned to the prompt', 'Thesaurus only', 'Erasing the question'], correct: 1 },
      { stem: 'Comma splice means:', choices: ['Two independent clauses joined only by a comma', 'A missing comma', 'A correct list', 'A question mark'], correct: 0 },
      { stem: 'Revision should prioritise:', choices: ['Only fancy vocabulary', 'Global clarity then local errors', 'Deleting the introduction', 'Smaller font'], correct: 1 },
    ],
    match: {
      text: 'Match exam move to reason.',
      points: 4,
      pairs: [
        ['Plan briefly', 'Prevents drift off-prompt'],
        ['Annotate reading', 'Speeds accurate evidence selection'],
        ['Budget review time', 'Catches obvious mistakes'],
      ],
    },
    shortQuiz: { text: 'What is one comma-splice fix pattern you will use in the exam? (one sentence)', points: 3 },
  },
];

function buildMatchingQuestion(spec) {
  const pairs = spec.match.pairs;
  const leftItems = pairs.map((p, i) => ({ id: `L${i + 1}`, text: p[0] }));
  const rightItems = pairs.map((p, i) => {
    const id = `L${i + 1}`;
    const text = p[1];
    return { id, text, isCorrect: true };
  });
  return {
    id: 'match1',
    type: 'matching',
    text: spec.match.text,
    points: spec.match.points,
    leftItems,
    rightItems,
  };
}

function buildQuizQuestions(spec) {
  const mc = spec.quizMc.map((q, idx) => ({
    id: `qz${idx}`,
    type: 'multiple-choice',
    text: q.stem,
    points: q.points ?? 2,
    options: q.choices.map((text, i) => ({
      text,
      isCorrect: i === q.correct,
    })),
  }));
  const matchQ = buildMatchingQuestion(spec);
  const shortQ = {
    id: 'short1',
    type: 'text',
    text: spec.shortQuiz.text,
    points: spec.shortQuiz.points,
  };
  return [...mc, matchQ, shortQ];
}

for (const spec of WEEKS) {
  addModule({
    title: `Week ${spec.n} — ${spec.theme}`,
    description: spec.description,
    pages: spec.pages,
    homework: spec.homework,
    quiz: spec.quizMc,
    quizQuestionsFull: buildQuizQuestions(spec),
  });
}

module.exports = {
  SEMESTER,
  COURSE_CODE,
  COURSE_TITLE,
  COURSE_DESCRIPTION,
  SYLLABUS_HTML,
  MODULE_SPECS,
};

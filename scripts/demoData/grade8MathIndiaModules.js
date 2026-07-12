'use strict';

const { SEMESTER, COURSE_CODE, COURSE_TITLE, COURSE_DESCRIPTION } = require('./grade8MathIndiaConstants');

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

/**
 * @typedef {{ title: string, description: string, pages: {title: string, html: string}[], homework: { title: string, description: string, questions: object[] }, quiz: { stem: string, choices: string[], correct: number, points?: number }[] }} ModuleSpec
 */

/** @type {ModuleSpec[]} */
const MODULE_SPECS = [];

function addModule(m) {
  MODULE_SPECS.push(m);
}

// ——— Module 1 ———
addModule({
  title: 'Rational Numbers',
  description:
    'Properties of rational numbers, representation on the number line, and density between two rationals — aligned with NCERT Class 8 Chapter 1.',
  pages: [
    {
      title: 'Overview: Rational Numbers',
      html: `<h2>Big picture</h2><p>You have worked with whole numbers and integers. <strong>Rational numbers</strong> widen the set so that quantities such as halves, thirds, and negatives of fractions are included and behave predictably under the four operations.</p><h3>Why this matters outside class</h3><p>Any situation that splits a whole into equal parts—sharing food, mixing paint in a ratio, average speed over a journey, or reading a scale between two marks—naturally uses fractions. Rationals give you a single language for all those “parts of a whole” stories, including when the part is <em>smaller than zero</em> (debts, temperatures below zero, or positions left of the origin on a line).</p><h3>Notation you will see</h3><ul><li>The set of rational numbers is often written <strong>ℚ</strong> (from “quotient”).</li><li>Every integer <code>n</code> is rational because <code>n = n/1</code>.</li><li>Two fractions can look different but name the same rational: <code>2/4 = 1/2</code>. We call them <strong>equivalent</strong>.</li></ul><h3>Learning outcomes</h3><ul><li>Recall closure, commutativity, and associativity for rational addition and multiplication.</li><li>Represent rationals on a number line and compare magnitudes.</li><li>Find rational numbers between two given rationals.</li></ul><h3>How we will work</h3><p>Each lesson combines a short explanation, a <em>worked example</em>, and practice that mirrors CBSE-style short and long answer items. Keep a habit of: (1) stating the form <code>p/q</code> with <code>q ≠ 0</code> when you justify “rational”; (2) reducing to lowest terms before you compare or add unless the question says otherwise.</p><blockquote><p><strong>Self-check:</strong> Without a calculator, explain why <code>0.25</code>, <code>−3</code>, and <code>5/−2</code> are all rational, and write each in the form <code>p/q</code> with <code>q &gt; 0</code>.</p></blockquote>`,
    },
    {
      title: 'Structure of rational numbers',
      html: `<h2>What counts as rational?</h2><p>A number is <strong>rational</strong> if it can be written as <em>p</em>/<em>q</em> where <em>p</em> and <em>q</em> are integers and <em>q</em> ≠ 0.</p>${table(
        ['Example', 'Rational form (one choice)', 'Lowest terms'],
        [
          ['<code>0.75</code>', '<code>75/100</code>', '<code>3/4</code>'],
          ['<code>-2.4</code>', '<code>-24/10</code>', '<code>-12/5</code>'],
          ['<code>0</code>', '<code>0/1</code>', '(already simplest)'],
          ['<code>7</code>', '<code>7/1</code>', '(integer)'],
        ]
      )}<h3>Equivalent fractions</h3><p>Multiplying numerator and denominator by the same non-zero integer does not change the value: <code>1/3 = 2/6 = 5/15</code>. That is why “cross-multiplying” to compare <code>a/b</code> and <code>c/d</code> is justified: you are secretly comparing <code>ad</code> and <code>bc</code> after clearing denominators.</p><h3>Why lowest terms matter</h3><p>Reducing <code>6/8</code> to <code>3/4</code> keeps comparisons and operations cleaner. Always cancel common factors in numerator and denominator before reporting a final answer unless the question asks otherwise.</p><h3>What is <em>not</em> rational? (preview)</h3><p>Numbers such as <code>√2</code> or <code>π</code> cannot be written as a single fraction of integers; you will meet them again as <strong>irrationals</strong>. For now, if a number has a <em>terminating or repeating</em> decimal expansion, it is rational; if a square root simplifies to an integer (e.g. <code>√49 = 7</code>), it is rational too.</p><h3>Sign in the numerator vs denominator</h3><p>You may write <code>−p/q</code> or <code>p/(−q)</code>; by convention many books fix <code>q &gt; 0</code> and carry the sign on <code>p</code>. Stick to one convention in your own work so teachers can read your steps quickly.</p>`,
    },
    {
      title: 'Number line and sign',
      html: `<h2>Plotting positives and negatives</h2><p>To plot <code>a/b</code> with <code>b &gt; 0</code>, divide the segment from 0 to 1 (or from <code>n</code> to <code>n+1</code>) into <code>b</code> equal parts and count <code>a</code> steps from the left if <code>a ≥ 0</code>, or from the right if <code>a &lt; 0</code>.</p><h3>Between which integers?</h3><p>Rewrite as a mixed number when helpful. For <code>7/4</code>: <code>7 = 4 + 3</code>, so <code>7/4 = 1 + 3/4</code>. The point lies strictly between <strong>1</strong> and <strong>2</strong>, closer to 2 because <code>3/4</code> is large.</p><h3>Comparing two rationals</h3><p>Write both with a <strong>common positive denominator</strong>, then compare numerators. Example: compare <code>5/6</code> and <code>7/9</code>. LCD is 18: <code>5/6 = 15/18</code>, <code>7/9 = 14/18</code>, so <code>5/6 &gt; 7/9</code>.</p><h3>Worked example</h3><p>Plot <strong>-5/3</strong>. Rewrite as <code>−(1 + 2/3)</code>. Start at 0, move left past -1, then two thirds of the way toward -2. The point lies strictly between -2 and -1.</p><blockquote><p><strong>Checkpoint:</strong> Is <code>-5/3</code> closer to -1 or to -2? Compare absolute remainders after removing the integer part: distance to -1 is <code>2/3</code>, distance to -2 is <code>1/3</code>, so it is <strong>closer to -2</strong>.</p></blockquote><h3>Sign and distance (intuition)</h3><p>The <strong>absolute value</strong> <code>|x|</code> is the distance from <code>x</code> to 0 on the line. So <code>|-5/3| = 5/3</code>, and <code>-5/3</code> is the point <code>5/3</code> units to the left of 0. Two numbers are <strong>opposites</strong> if they are the same distance from 0 on opposite sides, e.g. <code>3/4</code> and <code>-3/4</code>.</p><h3>Quick drill</h3><ol><li>Mark <code>0</code>, <code>1/2</code>, <code>-1/4</code>, and <code>9/4</code> on a rough number line sketch.</li><li>Order from least to greatest: <code>-2/3</code>, <code>0</code>, <code>-5/8</code>, <code>1/10</code>.</li></ol>`,
    },
    {
      title: 'Between two rationals',
      html: `<h2>Density idea</h2><p>Given distinct rationals <code>r</code> and <code>s</code>, their average <code>(r+s)/2</code> is rational and lies strictly between them. Repeating the trick shows infinitely many rationals between any two rationals.</p>${table(
        ['Given', 'First number strictly between them', 'Idea'],
        [
          ['<code>1/3</code> and <code>1/2</code>', '<code>(1/3+1/2)/2 = 5/12</code>', 'Average'],
          ['<code>-0.6</code> and <code>-0.55</code>', 'Convert to fractions (e.g. <code>-3/5</code> and <code>-11/20</code>), then average', 'Same rule with negatives'],
          ['<code>2/7</code> and <code>3/7</code>', '<code>(2/7+3/7)/2 = 5/14</code>', 'Both positive; average stays inside the gap'],
        ]
      )}<h3>Finding <em>several</em> numbers in the gap</h3><p>If <code>r &lt; s</code> and you want three rationals between them, you can use averages repeatedly: first <code>m₁ = (r+s)/2</code>, then between <code>r</code> and <code>m₁</code> take <code>m₂ = (r+m₁)/2</code>, and between <code>m₁</code> and <code>s</code> take <code>m₃ = (m₁+s)/2</code>. There are many other valid answers—your method only needs to be clearly justified.</p><h3>Decimals vs fractions</h3><p>Between two terminating decimals there are infinitely many rationals; do not assume the list “0.56, 0.57, …” is complete. The average method always produces another rational <em>strictly inside</em> the interval, even when the decimal expansion looks “full”.</p><h3>Common error</h3><p>Students sometimes list only terminating decimals between two decimals. Remember averages of rationals stay rational even when the decimal expansions are non-terminating.</p><h3>Challenge (optional)</h3><p>Show that <code>(r + 2s)/3</code> is also rational and lies between <code>r</code> and <code>s</code> when <code>r &lt; s</code>. Where does it sit compared to <code>(r+s)/2</code>?</p>`,
    },
    {
      title: 'Operations and properties',
      html: `<h2>Quick reference</h2>${table(
        ['Property', 'Addition', 'Multiplication'],
        [
          ['Closure', 'rationals + rationals = rational', 'rationals × rationals = rational'],
          ['Commutative', '<code>a+b = b+a</code>', '<code>ab = ba</code>'],
          ['Associative', '<code>(a+b)+c = a+(b+c)</code>', '<code>(ab)c = a(bc)</code>'],
        ]
      )}<h3>Identity and inverses</h3><p>0 is the additive identity; 1 is the multiplicative identity (for non-zero numbers). Every rational <code>p/q</code> has additive inverse <code>-p/q</code>, and every non-zero rational has multiplicative inverse <code>q/p</code>.</p><h3>Practice cue</h3><p>When simplifying nested fractions, multiply numerator and denominator by the least common denominator of all “small” denominators to clear fractions in one systematic step.</p>`,
    },
  ],
  homework: {
    title: 'Rational numbers — Assignment',
    description:
      'Show reasoning in words or short steps. Use exact fractions unless a question explicitly asks for decimals rounded to two places.',
    questions: [
      {
        id: 'h1',
        type: 'text',
        text: 'Express 2.36̄ (recurring) as a fraction in lowest terms.',
        points: 6,
      },
      {
        id: 'h2',
        type: 'text',
        text: 'Find three distinct rational numbers between 3/7 and 5/11. Explain your method.',
        points: 7,
      },
      {
        id: 'h3',
        type: 'text',
        text: 'Without calculating decimal values, decide which is greater: -9/13 or -11/17. Justify using a number line or inequality reasoning.',
        points: 7,
      },
    ],
  },
  quiz: [
    { stem: 'Which of the following is rational?', choices: ['√2', 'π', '0.10100100010000… (pattern gaps grow)', '−14/9'], correct: 3 },
    { stem: 'Additive inverse of −7/12 is:', choices: ['7/12', '−7/12', '12/7', '−12/7'], correct: 0 },
    { stem: 'Multiplicative inverse of 5/8 is:', choices: ['−5/8', '8/5', '−8/5', '5/8'], correct: 1 },
    { stem: 'Average of 1/4 and 1/6 lies at:', choices: ['1/5', '5/24', '1/10', '7/24'], correct: 1 },
    {
      stem: 'Which set is not closed under subtraction (when both operands must stay in the set)?',
      choices: ['Integers (ℤ)', 'Rational numbers (ℚ)', 'Positive counting numbers (1,2,3,…)', 'Real numbers (ℝ)'],
      correct: 2,
    },
  ],
});

// ——— Module 2 ———
addModule({
  title: 'Linear Equations in One Variable',
  description:
    'Translating situations to equations, transposing terms, and interpreting solutions — NCERT Class 8 Chapter 2.',
  pages: [
    {
      title: 'Overview: Linear equations',
      html: `<h2>Why this chapter matters</h2><p>Linear equations in one variable model balance: two sides of an equation represent the same quantity. You will move from informal “do the same to both sides” to fluent transposing.</p><h3>Outcomes</h3><ul><li>Solve equations of the form <code>ax + b = c</code> with rational coefficients.</li><li>Translate word problems into equations and interpret solutions in context.</li><li>Recognize when an equation has no solution or infinitely many solutions.</li></ul>`,
    },
    {
      title: 'Balancing and transposing',
      html: `<h2>Core moves</h2><p>Adding or subtracting the same quantity on both sides preserves equality. Multiplying or dividing both sides by the same <strong>non-zero</strong> number also preserves equality.</p><h3>Worked example</h3><p>Solve <code>3(x − 2) = 2x + 4</code>.</p><ol><li>Expand: <code>3x − 6 = 2x + 4</code>.</li><li>Transpose: <code>3x − 2x = 4 + 6</code> → <code>x = 10</code>.</li><li>Verify: LHS <code>3(10−2)=24</code>, RHS <code>2(10)+4=24</code>.</li></ol>`,
    },
    {
      title: 'Word problems',
      html: `<h2>From words to symbols</h2><p>Identify the unknown, assign a variable, and write two expressions that must be equal.</p><blockquote><p><strong>Example:</strong> The sum of three consecutive odd integers is 63. Let the smallest be <code>n</code>. Then <code>n + (n+2) + (n+4) = 63</code>, so <code>3n + 6 = 63</code> and <code>n = 19</code>. The integers are 19, 21, 23.</p></blockquote><h3>Table practice</h3>${table(
        ['Phrase', 'Equation skeleton'],
        [
          ['“5 more than twice a number is 17”', '<code>2x + 5 = 17</code>'],
          ['“Ages differ by 4; sum is 30”', '<code>x + (x+4) = 30</code>'],
        ]
      )}`,
    },
    {
      title: 'Special cases',
      html: `<h2>No solution vs many solutions</h2><p>Simplify both sides. If you reach <code>0x = 5</code>, there is <strong>no</strong> solution. If you reach <code>0x = 0</code>, every admissible value of <code>x</code> works — <strong>infinitely many</strong> solutions.</p><h3>Example</h3><p><code>2x + 3 = 2x − 1</code> → <code>3 = −1</code>: impossible.</p><p><code>4(x+1) = 4x + 4</code>: identity after expansion.</p>`,
    },
    {
      title: 'Mixed practice strategies',
      html: `<h2>Exam technique</h2><ul><li>State the equation before manipulating.</li><li>Show one verification step for long CBSE questions.</li><li>Watch sign errors when subtracting a bracket: <code>−(2x − 5) = −2x + 5</code>.</li></ul><h3>Reasoning item</h3><p>Explain why multiplying both sides by an expression containing the variable can introduce extraneous solutions. Tie to checking answers in context.</p>`,
    },
  ],
  homework: {
    title: 'Linear equations — Assignment',
    description: 'Include verification for the starred item.',
    questions: [
      { id: 'h1', type: 'text', text: 'Solve: (2y − 1)/3 − (y − 2)/5 = 1. *', points: 7 },
      { id: 'h2', type: 'text', text: 'The digit sum of a two-digit number is 9. If the digits are reversed, the new number exceeds the original by 27. Find the original number.', points: 8 },
      { id: 'h3', type: 'text', text: 'For what value of k does 3x + k = 3(x + 2) have infinitely many solutions? Explain.', points: 5 },
    ],
  },
  quiz: [
    { stem: 'Solution of 4x − 7 = 9 is', choices: ['x = 2', 'x = 4', 'x = 1', 'x = 3'], correct: 1 },
    { stem: 'Transpose 5x + 3 = 2x − 6 correctly:', choices: ['5x−2x = −6+3', '5x+2x = −6−3', '5x−2x = −6−3', '5x+2x = −6+3'], correct: 2 },
    { stem: '3(x−1)=3x−3 has', choices: ['no solution', 'one solution', 'infinitely many', 'x=0 only'], correct: 2 },
    { stem: 'Twice a number increased by 5 gives 21. Equation:', choices: ['2x+5=21', 'x+5=21', '2x=21', '5x+2=21'], correct: 0 },
    { stem: 'If 7x = 42 then x equals', choices: ['5', '6', '7', '8'], correct: 1 },
  ],
});

// ——— Modules 3–13 (full syllabus list with rich pages) ———

addModule({
  title: 'Understanding Quadrilaterals',
  description: 'Angles, polygons, parallelograms, and special quadrilaterals — NCERT Class 8 Chapter 3.',
  pages: [
    {
      title: 'Overview: Quadrilaterals',
      html: `<h2>Goals</h2><p>Classify polygons, use angle sum formulas, and apply properties of parallelograms, rectangles, rhombuses, and squares with clear reasons.</p><h3>Angle sum</h3><p>Interior sum of an <code>n</code>-gon is <code>(n−2)×180°</code>. Exterior sum (one per vertex) is always <code>360°</code>.</p>`,
    },
    {
      title: 'Parallelogram criteria',
      html: `<h2>What forces a parallelogram?</h2><ul><li>Both pairs of opposite sides parallel (definition).</li><li>Both pairs of opposite sides equal.</li><li>Both pairs of opposite angles equal.</li><li>Diagonals bisect each other.</li></ul><h3>Worked example</h3><p>If diagonals of quadrilateral <code>ABCD</code> bisect each other at <code>O</code>, prove <code>ABCD</code> is a parallelogram using triangle congruence (<code>△AOB ≅ △COD</code>).</p>`,
    },
    {
      title: 'Special types',
      html: `<h2>Hierarchy</h2>${table(
        ['Shape', 'Extra beyond parallelogram'],
        [
          ['Rectangle', 'All angles 90°'],
          ['Rhombus', 'All sides equal'],
          ['Square', 'Both of the above'],
        ]
      )}<p>A square is a rectangle that is also a rhombus.</p>`,
    },
    {
      title: 'Angle chasing',
      html: `<h2>Technique</h2><p>Use linear pairs, alternate interior angles with parallel lines, and triangle angle sums. Label unknowns sparingly — one variable often controls the whole figure.</p><blockquote><p>In a parallelogram, adjacent angles are supplementary.</p></blockquote>`,
    },
    {
      title: 'Problem-solving template',
      html: `<h2>Proof skeleton (CBSE style)</h2><ol><li>State given / to prove.</li><li>Draw a neat figure with given markings.</li><li>Choose congruence criterion (SAS, ASA, SSS, RHS).</li><li>Conclude sides or angles needed for the property.</li></ol>`,
    },
  ],
  homework: {
    title: 'Quadrilaterals — Assignment',
    description: 'Reasons must be stated for geometry items.',
    questions: [
      { id: 'h1', type: 'text', text: 'Each exterior angle of a regular polygon is 24°. How many sides does it have?', points: 5 },
      { id: 'h2', type: 'text', text: 'In parallelogram ABCD, ∠A = (3x−2)° and ∠C = (2x+18)°. Find x and all angles.', points: 7 },
      { id: 'h3', type: 'text', text: 'Prove that if diagonals of a parallelogram are equal, then it is a rectangle.', points: 8 },
    ],
  },
  quiz: [
    { stem: 'Sum of interior angles of a hexagon', choices: ['720°', '540°', '600°', '900°'], correct: 0 },
    { stem: 'Each interior angle of a regular pentagon', choices: ['108°', '120°', '72°', '90°'], correct: 0 },
    { stem: 'In a parallelogram, opposite angles are', choices: ['supplementary', 'equal', 'complementary', '90°'], correct: 1 },
    { stem: 'Diagonals of a rhombus', choices: ['are always equal', 'bisect vertex angles', 'never intersect', 'are parallel'], correct: 1 },
    { stem: 'A quadrilateral with one pair of sides parallel is', choices: ['always a trapezium', 'always a parallelogram', 'never cyclic', 'always a kite'], correct: 0 },
  ],
});

addModule({
  title: 'Data Handling',
  description: 'Tables, histograms, frequency polygons, pie charts, chance — NCERT Class 8 Chapter 5.',
  pages: [
    {
      title: 'Overview: Data handling',
      html: `<h2>Statistical literacy</h2><p>You will read and construct displays, choose class intervals thoughtfully, and connect relative frequency to probability intuitions suitable for Class 8.</p>`,
    },
    {
      title: 'Histograms vs bar graphs',
      html: `<h2>Continuous vs categorical</h2><p>Histograms show <strong>frequency density</strong> for numerical data with class intervals; bars touch. Bar graphs separate categories that are not inherently ordered intervals.</p><h3>Class width</h3><p>If intervals are unequal, vertical size should reflect <em>density</em> (frequency ÷ width), not raw counts alone.</p>`,
    },
    {
      title: 'Frequency polygon',
      html: `<h2>Midpoints</h2><p>Plot points at each class midpoint at height equal to frequency (or density). Join with straight segments; optionally project to baseline for closure.</p>`,
    },
    {
      title: 'Pie charts',
      html: `<h2>Angles from percentages</h2><p>Central angle = percentage × 3.6° (since 100% = 360°). Always label sectors or provide a legend.</p>${table(
        ['Category', 'Percent', 'Angle'],
        [
          ['Transport', '25%', '90°'],
          ['Food', '40%', '144°'],
        ]
      )}`,
    },
    {
      title: 'Chance experiments',
      html: `<h2>Empirical probability</h2><p><code>P(E) ≈ (number of times E happened) / (total trials)</code> for a long sequence of independent trials. Distinguish <em>theoretical</em> models (fair coin) from <em>empirical</em> estimates from data.</p>`,
    },
  ],
  homework: {
    title: 'Data handling — Assignment',
    description: 'Attach rough sketches where asked (ASCII sketch in text is acceptable for this LMS).',
    questions: [
      { id: 'h1', type: 'text', text: 'Scores: 12,15,18,18,20,22,22,25,30. Choose class intervals of width 6 starting at 12. Make a frequency table.', points: 6 },
      { id: 'h2', type: 'text', text: 'Explain one situation where a histogram is preferable to a pie chart.', points: 5 },
      { id: 'h3', type: 'text', text: 'A die was thrown 120 times: 1→22, 2→18, 3→20, 4→17, 5→15, 6→28. Estimate P(6) empirically.', points: 4 },
    ],
  },
  quiz: [
    { stem: 'Histogram bars should', choices: ['always have gaps', 'touch for continuous classes', 'only be vertical', 'never show density'], correct: 1 },
    { stem: '25% sector angle', choices: ['72°', '90°', '100°', '120°'], correct: 1 },
    { stem: 'Frequency polygon joins', choices: ['class width points', 'class midpoints', 'random points', 'origin only'], correct: 1 },
    { stem: 'Empirical probability improves with', choices: ['fewer trials', 'more trials', 'larger class width', 'smaller pie'], correct: 1 },
    { stem: 'Which is categorical?', choices: ['Height of students', 'Favourite sport', 'Temperature', 'Time to school'], correct: 1 },
  ],
});

addModule({
  title: 'Squares and Square Roots',
  description: 'Patterns, Pythagorean triples intuition, factorisation method, division method — NCERT Class 8 Chapter 6.',
  pages: [
    {
      title: 'Overview: Squares and roots',
      html: `<h2>Goals</h2><p>Recognise perfect squares, compute square roots for large perfect squares via prime factorisation, and estimate roots of non-perfect squares between consecutive integers.</p>`,
    },
    {
      title: 'Patterns in unit digits',
      html: `<h2>Which digits can end a perfect square?</h2><p>Possible unit digits of a square: <code>0,1,4,5,6,9</code> only. Use this as a quick filter in Olympiad-style multiple choice.</p>`,
    },
    {
      title: 'Prime factorisation method',
      html: `<h2>Algorithm</h2><ol><li>Factor <code>n</code> completely.</li><li>Pair equal primes.</li><li>For each pair, take one copy out of the root.</li><li>Unpaired primes stay under the root in radical form if <code>n</code> is not a perfect square.</li></ol><h3>Example</h3><p><code>√576 = √(2^6·3^2) = 2^3·3 = 24</code>.</p>`,
    },
    {
      title: 'Division method sketch',
      html: `<h2>Long-division style</h2><p>Group digits in pairs from the decimal point. Each step finds the next digit of the root by maximizing without overshooting — practise on board with 529 and 1369.</p>`,
    },
    {
      title: 'Estimation',
      html: `<h2>Bounding non-perfect squares</h2><p><code>√50</code> lies between 7 and 8 since <code>49&lt;50&lt;64</code>. Linear interpolation gives a rough first estimate (~7.07) before calculator check.</p>`,
    },
  ],
  homework: {
    title: 'Squares & roots — Assignment',
    description: 'Show factorisation for perfect squares.',
    questions: [
      { id: 'h1', type: 'text', text: 'Compute √8281 by prime factorisation.', points: 6 },
      { id: 'h2', type: 'text', text: 'Find smallest whole k such that 180k is a perfect square.', points: 7 },
      { id: 'h3', type: 'text', text: 'Estimate √90 to one decimal place without a calculator, explaining bounds.', points: 7 },
    ],
  },
  quiz: [
    { stem: 'Unit digit of 237² is', choices: ['3', '7', '9', '1'], correct: 2 },
    { stem: '√144 equals', choices: ['11', '12', '13', '14'], correct: 1 },
    { stem: 'Smallest n so n² ≥ 200', choices: ['13', '14', '15', '16'], correct: 2 },
    { stem: 'Which cannot be a perfect square?', choices: ['256', '400', '500', '625'], correct: 2 },
    { stem: '√(81/16) equals', choices: ['9/4', '3/2', '9/2', '81/4'], correct: 0 },
  ],
});

addModule({
  title: 'Cubes and Cube Roots',
  description: 'Cube patterns, prime factorisation method for cube roots — NCERT Class 8 Chapter 7.',
  pages: [
    {
      title: 'Overview: Cubes and roots',
      html: `<h2>Why cubes?</h2><p>Volume of a cube scales as edge³. Cube roots invert cubing and appear in mensuration and science formulas.</p>`,
    },
    {
      title: 'Unit digits of cubes',
      html: `<h2>Pattern table</h2><p>Each digit 0–9 cubes to a predictable unit digit; use for verification after manual multiplication.</p>`,
    },
    {
      title: 'Factorisation method',
      html: `<h2>Cube root from primes</h2><p>Group primes in triples: <code>∛(2^6·5^3) = 2^2·5 = 20</code>.</p><h3>Harder case</h3><p>If any exponent is not a multiple of 3, the number is not a perfect cube.</p>`,
    },
    {
      title: 'Applications',
      html: `<h2>Volume problems</h2><p>If a cubical tank holds 512 m³, edge length is <code>∛512 = 8</code> m. Always attach correct cubic units.</p>`,
    },
    {
      title: 'Estimation',
      html: `<h2>Bounding</h2><p><code>∛50</code> lies between 3 and 4 because <code>27&lt;50&lt;64</code>. Refine with linear approximation if needed.</p>`,
    },
  ],
  homework: {
    title: 'Cubes & roots — Assignment',
    description: 'Use exact values.',
    questions: [
      { id: 'h1', type: 'text', text: 'Evaluate ∛(−3375) without a calculator.', points: 5 },
      { id: 'h2', type: 'text', text: 'Find smallest k such that 72k is a perfect cube.', points: 7 },
      { id: 'h3', type: 'text', text: 'A metal cube of volume 2197 cm³ is melted into smaller cubes of edge 1 cm. How many small cubes?', points: 5 },
    ],
  },
  quiz: [
    { stem: '∛64 equals', choices: ['2', '3', '4', '8'], correct: 2 },
    { stem: 'Cube of −5', choices: ['−125', '125', '−15', '25'], correct: 0 },
    { stem: 'Which is a perfect cube?', choices: ['400', '8000', '900', '250'], correct: 1 },
    { stem: '∛(27/64)', choices: ['3/4', '9/16', '3/8', '4/3'], correct: 0 },
    { stem: 'Edge of cube volume 512 cm³', choices: ['6 cm', '7 cm', '8 cm', '9 cm'], correct: 2 },
  ],
});

addModule({
  title: 'Comparing Quantities',
  description: 'Percentages, profit and loss, discount, simple and compound interest — NCERT Class 8 Chapter 8.',
  pages: [
    {
      title: 'Overview: Comparing quantities',
      html: `<h2>Applications</h2><p>Commercial arithmetic and interest formulas connect mathematics to everyday banking and shopping contexts examined in board papers.</p>`,
    },
    {
      title: 'Percent change',
      html: `<h2>Relative change</h2><p>Percent increase = <code>(new−old)/old × 100%</code>. For successive changes, multiply factors: a rise of 20% then a fall of 10% multiplies by <code>1.2×0.9 = 1.08</code> (net +8%).</p>`,
    },
    {
      title: 'Profit & loss',
      html: `${table(
        ['Term', 'Formula'],
        [
          ['Profit', 'SP − CP (when positive)'],
          ['Loss', 'CP − SP (when positive)'],
          ['Profit %', 'profit/CP × 100%'],
        ]
      )}`,
    },
    {
      title: 'Simple interest',
      html: `<p><code>SI = PRT/100</code> with <code>T</code> in years consistent with <code>R</code> annual rate. Amount <code>A = P + SI</code>.</p><h3>Worked example</h3><p>P = ₹8000, R = 6% p.a., T = 2.5 years → SI = <code>8000×6×2.5/100 = ₹1200</code>.</p>`,
    },
    {
      title: 'Compound interest yearly',
      html: `<p>Yearly compounding: <code>A = P(1 + R/100)^n</code>. CI = A − P. Compare with SI for same data to see divergence over time.</p>`,
    },
  ],
  homework: {
    title: 'Comparing quantities — Assignment',
    description: 'Currency in ₹; time in years unless stated.',
    questions: [
      { id: 'h1', type: 'text', text: 'A shop offers 20% discount on marked price and still makes 12% profit on cost. If MP is ₹560, find CP.', points: 8 },
      { id: 'h2', type: 'text', text: 'Find SI on ₹15000 at 8% p.a. for 9 months.', points: 5 },
      { id: 'h3', type: 'text', text: 'Population increases 5% yearly. After 2 years from 40,000, what is population (nearest integer)?', points: 7 },
    ],
  },
  quiz: [
    { stem: '10% of 250', choices: ['20', '25', '30', '35'], correct: 1 },
    { stem: 'SP when CP=400, profit 15%', choices: ['415', '430', '460', '450'], correct: 2 },
    { stem: 'SI on 1000 at 5% for 2 years', choices: ['90', '100', '110', '120'], correct: 1 },
    { stem: 'Compound factor 10% for 2 years', choices: ['1.20', '1.21', '1.10', '1.00'], correct: 1 },
    { stem: 'Loss% when CP=500, SP=450', choices: ['12%', '10%', '8%', '15%'], correct: 1 },
  ],
});

addModule({
  title: 'Algebraic Expressions and Identities',
  description: 'Terms, coefficients, standard identities, multiplication — NCERT Class 8 Chapter 9.',
  pages: [
    {
      title: 'Overview: Algebraic expressions',
      html: `<h2>Fluency targets</h2><p>Add/subtract like terms, multiply monomial by polynomial, and apply identities to expand and factorise mentally where possible.</p>`,
    },
    {
      title: 'Identities (x±a)² and (x+a)(x+b)',
      html: `<h2>Core identities</h2><ul><li><code>(a+b)² = a² + 2ab + b²</code></li><li><code>(a−b)² = a² − 2ab + b²</code></li><li><code>(a+b)(a−b) = a² − b²</code></li><li><code>(x+a)(x+b) = x² + (a+b)x + ab</code></li></ul>`,
    },
    {
      title: 'Worked expansion',
      html: `<p>Expand <code>(2x − 3y)²</code>: <code>4x² − 12xy + 9y²</code>. Check middle term twice — sign errors are common.</p>`,
    },
    {
      title: 'Substitution',
      html: `<h2>Evaluate expressions</h2><p>If <code>x = −2</code>, value of <code>3x² − 5x + 1</code> is <code>3(4) −5(−2)+1 = 23</code>. Track parentheses with negatives.</p>`,
    },
    {
      title: 'Problem patterns',
      html: `<h2>Board-style items</h2><p>Use identities to compute <code>103×97</code> as <code>(100+3)(100−3)=10000−9=9991</code>.</p>`,
    },
  ],
  homework: {
    title: 'Algebraic expressions — Assignment',
    description: 'Expand fully; no calculators for integer arithmetic parts.',
    questions: [
      { id: 'h1', type: 'text', text: 'Expand and simplify: (3p − 2q)(3p + 2q) + (2p + q)².', points: 7 },
      { id: 'h2', type: 'text', text: 'Use identity to evaluate 99².', points: 4 },
      { id: 'h3', type: 'text', text: 'Subtract 4x² − 3xy + y² from x² + 5xy − 2y².', points: 6 },
    ],
  },
  quiz: [
    { stem: '(a+b)² equals', choices: ['a²+b²', 'a²+2ab+b²', 'a²−2ab+b²', 'a²−b²'], correct: 1 },
    { stem: '(x+4)(x−4)', choices: ['x²+16', 'x²−16', 'x²−8', 'x²+8'], correct: 1 },
    { stem: 'Coefficient of xy in (2x+3y)²', choices: ['6', '12', '9', '4'], correct: 1 },
    { stem: 'Like terms in 3x²y and −5yx²', choices: ['unlike', 'like', 'constant', 'degree 3 only'], correct: 1 },
    { stem: 'Value of (a−b)² when a=5,b=3', choices: ['4', '16', '2', '64'], correct: 0 },
  ],
});

addModule({
  title: 'Mensuration',
  description: 'Surface area and volume of cuboid, cube, cylinder; applications — NCERT Class 8 Chapter 11.',
  pages: [
    {
      title: 'Overview: Mensuration',
      html: `<h2>Measurement themes</h2><p>Relate nets of solids to formulas, convert units consistently, and interpret composite solids as sums/differences of standard pieces.</p>`,
    },
    {
      title: 'Cuboid and cube',
      html: `${table(
        ['Solid', 'Volume', 'Surface area'],
        [
          ['Cuboid <code>l×b×h</code>', '<code>lbh</code>', '<code>2(lb+bh+hl)</code>'],
          ['Cube edge <code>a</code>', '<code>a³</code>', '<code>6a²</code>'],
        ]
      )}`,
    },
    {
      title: 'Right circular cylinder',
      html: `<p><code>V = πr²h</code>, curved surface <code>2πrh</code>, total surface <code>2πr(r+h)</code>. Use consistent units (e.g., cm throughout).</p>`,
    },
    {
      title: 'Composite solids',
      html: `<h2>Strategy</h2><p>Decompose, compute each volume, add or subtract. For surface area, hide internal faces where solids are glued.</p>`,
    },
    {
      title: 'Applications',
      html: `<p>Water tank filling rates: volume ÷ rate = time. Paint coverage problems: total area ÷ coverage per litre = litres needed.</p>`,
    },
  ],
  homework: {
    title: 'Mensuration — Assignment',
    description: 'Take π = 22/7 unless exact form requested.',
    questions: [
      { id: 'h1', type: 'text', text: 'Find volume of a cylinder r=7 cm, h=10 cm.', points: 5 },
      { id: 'h2', type: 'text', text: 'An open box is made from a 20×15 sheet by cutting 3 cm squares from corners and folding. Find volume.', points: 8 },
      { id: 'h3', type: 'text', text: 'Two cubes of edges 4 cm and 5 cm are melted into one cube. Find edge of new cube (nearest mm).', points: 8 },
    ],
  },
  quiz: [
    { stem: 'Volume of cube edge 3 cm', choices: ['9', '18', '27', '36'], correct: 2 },
    { stem: 'CSA of cylinder r=1,h=2 (π symbolic)', choices: ['2π', '3π', '4π', 'π'], correct: 2 },
    { stem: 'Surface area of cuboid 2×3×4', choices: ['52', '24', '26', '48'], correct: 0 },
    { stem: 'Volume units of mm³ mean', choices: ['length', 'area', 'volume', 'time'], correct: 2 },
    { stem: 'Doubling edge of cube scales volume by', choices: ['2', '4', '6', '8'], correct: 3 },
  ],
});

addModule({
  title: 'Exponents and Powers',
  description: 'Laws of exponents, standard form, very large and small numbers — NCERT Class 8 Chapter 12.',
  pages: [
    {
      title: 'Overview: Exponents',
      html: `<h2>Goals</h2><p>Manipulate powers with integer exponents, express numbers in scientific notation, and interpret orders of magnitude in science contexts.</p>`,
    },
    {
      title: 'Laws summary',
      html: `${table(
        ['Law', 'Pattern'],
        [
          ['Product', '<code>a^m · a^n = a^{m+n}</code>'],
          ['Quotient', '<code>a^m / a^n = a^{m−n}</code> (a≠0)'],
          ['Power of power', '<code>(a^m)^n = a^{mn}</code>'],
          ['Zero exponent', '<code>a^0 = 1</code> (a≠0)'],
        ]
      )}`,
    },
    {
      title: 'Negative exponents',
      html: `<p><code>a^{−n} = 1/a^n</code>. Apply to simplify expressions with variables in denominator.</p>`,
    },
    {
      title: 'Standard form',
      html: `<p>Write <code>m × 10^k</code> where <code>1 ≤ m &lt; 10</code> and <code>k</code> is integer. Example: <code>0.000045 = 4.5 × 10^{−5}</code>.</p>`,
    },
    {
      title: 'Applications',
      html: `<p>Compare populations, astronomical distances, and microscopic lengths using consistent powers of ten.</p>`,
    },
  ],
  homework: {
    title: 'Exponents — Assignment',
    description: 'Simplify with positive exponents in final answer unless standard form requested.',
    questions: [
      { id: 'h1', type: 'text', text: 'Simplify: (2^5 × 3^−2 × 2^−3) / (2^2 × 3^−4).', points: 7 },
      { id: 'h2', type: 'text', text: 'Express 0.000000082 in standard form.', points: 4 },
      { id: 'h3', type: 'text', text: 'If 2^x = 1/32, find x.', points: 4 },
    ],
  },
  quiz: [
    { stem: '2³ × 2⁴', choices: ['2⁷', '2¹²', '4⁷', '2'], correct: 0 },
    { stem: '(3²)³', choices: ['3⁵', '3⁶', '3⁹', '9³'], correct: 1 },
    { stem: '5⁻² equals', choices: ['−25', '1/25', '25', '−1/25'], correct: 1 },
    { stem: 'Standard form of 3400', choices: ['3.4×10³', '34×10²', '3.4×10⁴', '0.34×10⁴'], correct: 0 },
    { stem: '10⁰', choices: ['0', '1', '10', 'undefined'], correct: 1 },
  ],
});

addModule({
  title: 'Direct and Inverse Proportions',
  description: 'Variation models, unitary method, joint variation basics — NCERT Class 8 Chapter 13.',
  pages: [
    {
      title: 'Overview: Proportions',
      html: `<h2>Two big ideas</h2><p><strong>Direct:</strong> ratio y/x constant. <strong>Inverse:</strong> product xy constant. Recognise context before applying formulas.</p>`,
    },
    {
      title: 'Direct variation',
      html: `<p>If <code>y ∝ x</code>, then <code>y = kx</code>. Given one pair, find <code>k</code>, then predict.</p><blockquote>12 notebooks cost ₹180 → cost of 20 notebooks?</blockquote><p><code>k = 180/12 = 15</code> ₹ per notebook → <code>20×15 = 300</code>.</p>`,
    },
    {
      title: 'Inverse variation',
      html: `<p>If <code>y ∝ 1/x</code>, then <code>xy = k</code>. Workers and time: more workers → less time for same job.</p>`,
    },
    {
      title: 'Unitary method',
      html: `<h2>One step at a time</h2><p>Reduce to a single unit, then scale. Works for both direct and inverse if set up carefully.</p>`,
    },
    {
      title: 'Mixed problems',
      html: `<p>Speed–time–distance: for fixed distance, speed and time are inversely proportional. Map each story to direct or inverse before algebra.</p>`,
    },
  ],
  homework: {
    title: 'Proportions — Assignment',
    description: 'State whether direct or inverse in each part.',
    questions: [
      { id: 'h1', type: 'text', text: 'If 8 pumps empty a tank in 90 minutes, how long for 12 pumps (same rate)?', points: 6 },
      { id: 'h2', type: 'text', text: 'y varies directly as x; y=28 when x=7. Find y when x=11.', points: 5 },
      { id: 'h3', type: 'text', text: '48 men can dig a trench in 14 days. After 6 days, 12 men leave. How many extra days to finish?', points: 9 },
    ],
  },
  quiz: [
    { stem: 'If x doubles and y halves, xy', choices: ['doubles', 'halves', 'stays same', 'quadruples'], correct: 2 },
    { stem: 'More workers, same work → time', choices: ['increases', 'decreases', 'unchanged', 'doubles always'], correct: 1 },
    { stem: 'If y∝x and y=10 at x=2, k=', choices: ['5', '20', '8', '12'], correct: 0 },
    { stem: 'Inverse: xy=60. If x=4, y=', choices: ['12', '15', '20', '10'], correct: 1 },
    { stem: 'Speed tripled, time for same distance', choices: ['×3', '÷3', 'same', '×9'], correct: 1 },
  ],
});

addModule({
  title: 'Factorisation',
  description: 'Taking out common factors, regrouping, identities as factors — NCERT Class 8 Chapter 14.',
  pages: [
    {
      title: 'Overview: Factorisation',
      html: `<h2>Goals</h2><p>Factorise polynomials by HCF, regrouping terms, and using standard identities read backwards.</p>`,
    },
    {
      title: 'Common factors',
      html: `<p>Always pull out numerical HCF and each variable to the smallest power appearing in every term.</p>`,
    },
    {
      title: 'Regrouping',
      html: `<p>Example: <code>ax + ay + bx + by = a(x+y)+b(x+y)=(a+b)(x+y)</code>.</p>`,
    },
    {
      title: 'Using identities',
      html: `<p>Recognise <code>a²−b²</code>, perfect squares, and <code>x²+(a+b)x+ab</code> pattern for splitting the middle term (preview to quadratics).</p>`,
    },
    {
      title: 'Check by expansion',
      html: `<h2>Habit</h2><p>Mentally multiply factors to catch sign slips before submitting exam answers.</p>`,
    },
  ],
  homework: {
    title: 'Factorisation — Assignment',
    description: 'Factorise completely over integers.',
    questions: [
      { id: 'h1', type: 'text', text: 'Factorise: 12x²y − 18xy².', points: 4 },
      { id: 'h2', type: 'text', text: 'Factorise: x² − 7x − 30.', points: 7 },
      { id: 'h3', type: 'text', text: 'Factorise: (a² − b²) − (a − b)².', points: 8 },
    ],
  },
  quiz: [
    { stem: 'Factor of x²−9', choices: ['x−3 only', '(x−3)(x+3)', '(x+3)²', 'x+9'], correct: 1 },
    { stem: 'HCF of 6x²y and 9xy', choices: ['3xy', '18x²y', 'xy', '3x²y'], correct: 0 },
    { stem: 'x²+5x+6 factors as', choices: ['(x+1)(x+6)', '(x+2)(x+3)', '(x−2)(x−3)', '(x+5)(x+1)'], correct: 1 },
    { stem: 'a²+2ab+b² is', choices: ['(a−b)²', '(a+b)²', '(a+b)(a−b)', 'prime'], correct: 1 },
    { stem: 'Factor x(x−2)+3(x−2)', choices: ['(x+3)(x−2)', '(x+3)(x+2)', '(x−3)(x−2)', '(x)(x−2)'], correct: 0 },
  ],
});

addModule({
  title: 'Introduction to Graphs',
  description: 'Line graphs, linear relationships, reading coordinates — NCERT Class 8 Chapter 15.',
  pages: [
    {
      title: 'Overview: Graphs',
      html: `<h2>Visualising relationships</h2><p>Plot ordered pairs, interpret slope informally as “rise over run” for uniform rates, and read real-world stories from graphs.</p>`,
    },
    {
      title: 'Cartesian plane',
      html: `<p>Axes intersect at origin <code>O</code>. Quadrant signs I(+,+), II(−,+), III(−,−), IV(+,−). Plot points accurately on grid paper in written exams.</p>`,
    },
    {
      title: 'Line graphs vs linear equations',
      html: `<p>A line graph connects time-ordered measurements. A graph of <code>y = mx + c</code> is a straight line showing all pairs satisfying the relation.</p>`,
    },
    {
      title: 'Reading slope from context',
      html: `<p>Distance–time graph: steeper means faster. Flat segment means rest. Negative slope (rare in distance) would mean returning — clarify if “distance from start” vs “displacement”.</p>`,
    },
    {
      title: 'Plotting from a table',
      html: `<h3>Example</h3>${table(
        ['x', '0', '1', '2'],
        [
          ['y = 2x+1', '1', '3', '5'],
        ]
      )}<p>Points lie on a straight line; draw with ruler and label at least three points.</p>`,
    },
  ],
  homework: {
    title: 'Graphs — Assignment',
    description: 'Describe shapes in words where grid not available.',
    questions: [
      { id: 'h1', type: 'text', text: 'Plot points A(2,3), B(−1,4), C(−2,−3). What type of triangle is ABC (by sides or angles) if AB=√10, BC=√50, AC=√37? Show calculations.', points: 9 },
      { id: 'h2', type: 'text', text: 'From a distance–time graph that is a straight line through (0,0) and (2,80) with time in hours and distance in km, find the speed.', points: 5 },
      { id: 'h3', type: 'text', text: 'Give an example of a graph that is <em>not</em> a straight line and say what quantity it could represent.', points: 5 },
    ],
  },
  quiz: [
    { stem: 'Point (−3,4) lies in quadrant', choices: ['I', 'II', 'III', 'IV'], correct: 1 },
    { stem: 'y = 2x passes through', choices: ['(0,2)', '(1,1)', '(0,0)', '(2,0)'], correct: 2 },
    { stem: 'Slope of line through (0,0) and (4,10)', choices: ['2.5', '0.4', '4', '10'], correct: 0 },
    { stem: 'x-axis equation', choices: ['x=0', 'y=0', 'y=x', 'x+y=0'], correct: 1 },
    { stem: 'Horizontal line y=5 has slope', choices: ['5', '0', '1', 'undefined'], correct: 1 },
  ],
});

const SYLLABUS_HTML = `<h1>${esc(COURSE_TITLE)}</h1><p><strong>Instructor of record:</strong> MySl8te demo teacher account. <strong>Semester:</strong> ${esc(
  SEMESTER.term
)} ${SEMESTER.year} (${SEMESTER.start.toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${SEMESTER.end.toLocaleDateString('en-IN', { dateStyle: 'medium' })}, Indian Standard Time).</p><h2>Course description</h2><p>${esc(
  COURSE_DESCRIPTION
)}</p><h2>Textbook alignment</h2><p>Topics follow the NCERT Mathematics textbook for Class VIII (Ganita) and typical CBSE term-wise pacing. Assessment mixes daily practice, structured problem sets, short machine-graded checks, group collaboration, and a data project.</p><h2>Assessment weights (demo)</h2>${table(
  ['Component', 'Weight'],
  [
    ['Homework & practice', '25%'],
    ['Quizzes (graded)', '20%'],
    ['Participation (discussions, polls)', '10%'],
    ['Group project', '15%'],
    ['Term quiz games (QuizWave)', '10%'],
    ['End-term synthesis', '20%'],
  ]
)}<h2>Academic integrity</h2><p>Show honest attempt on homework; cite any sources beyond the textbook. Calculators may be used only where announced.</p><h2>Communication</h2><p>Announcements and meetings will use this course shell. Check the overview weekly for revision plan and exam countdown.</p>`;

module.exports = {
  SEMESTER,
  COURSE_CODE,
  COURSE_TITLE,
  COURSE_DESCRIPTION,
  SYLLABUS_HTML,
  MODULE_SPECS,
};

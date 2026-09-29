import { useState } from 'react';
import { getDistrictResults, getMatchWinner, type Match } from '../gameEngine';
import { describeTutorialBoard } from './tutorialRecap';

/** Optional self-check: no additional gate or account mutation. */
export function RookieTeachBack({ match }: { match: Match }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const results = getDistrictResults(match);
  const changed = match.effectLog.find(event => event.scores.after.some((score, lane) =>
    score.player !== event.scores.before[lane]?.player || score.cpu !== event.scores.before[lane]?.cpu));
  const questions = [
    {
      question: 'What wins a fade?',
      options: ['Most Hands added across the whole board', 'Lead in at least two of three districts at the finish'],
      correct: 1,
      explanation: 'Each district is one claim. A tie claims nothing; total Hands across the board is not the tiebreaker.',
    },
    {
      question: 'When does the rival get to respond?',
      options: ['After every card you tap', 'When you end your turn'],
      correct: 1,
      explanation: 'In a normal turn you can play more affordable cards before End Turn. This coached fade asked for one play in each playing round.',
    },
    {
      question: 'Why might the score change after a card lands?',
      options: ['Only the printed Hands count', 'Location rules, abilities and statuses can change Hands or move cards'],
      correct: 1,
      explanation: changed
        ? `Your match: ${changed.note} The event history and replay show the exact before-and-after scores.`
        : 'Some effects prepare a later change without changing this score immediately. Check history and the district mat.',
    },
    {
      question: 'What decided this result?',
      options: ['The final district claims', 'The first district to reach ten Hands'],
      correct: 0,
      explanation: describeTutorialBoard(match),
    },
    {
      question: 'What can you do after this guided fade?',
      options: ['Claim the welcome reward and enter Chapter One, or practice with your saved gang first', 'You must buy a new gang to keep these cards'],
      correct: 0,
      explanation: 'Your starter collection and saved gang stay yours. Practice is optional; claim the welcome reward before entering Chapter One.',
    },
  ];
  const correctCount = questions.filter((item, index) => answers[index] === item.correct).length;
  return <details className="result-stage__teach-back" data-testid="rookie-teach-back">
    <summary>Check what you learned (optional)</summary>
    <p>Try each answer before opening the explanation. This check does not change your result or rewards.</p>
    {questions.map((item, index) => <fieldset key={item.question} className="result-stage__teach-question">
      <legend>{index + 1}. {item.question}</legend>
      {item.options.map((option, choice) => <label key={option}>
        <input type="radio" name={`rookie-check-${index}`} checked={answers[index] === choice}
          onChange={() => setAnswers(current => ({ ...current, [index]: choice }))} />
        {option}
      </label>)}
      {answers[index] !== undefined && <p role="status">{answers[index] === item.correct ? 'Right. ' : 'Not quite. '}{item.explanation}</p>}
    </fieldset>)}
    <p role="status">{Object.keys(answers).length} of {questions.length} answered · {correctCount} correct. You can retry any answer.</p>
    {results.length === 3 && <p>Ready to keep going? The continue button above is always available.</p>}
  </details>;
}
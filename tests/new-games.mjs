import assert from 'node:assert/strict';
import {advanceSnake} from '../app/games/snake.js';
import {shuffleBoard,moveTile,solved} from '../app/games/slide.js';
assert.equal(advanceSnake([[11,0],[10,0]],[1,0],[5,5]),null,'Wall collision ends the round');
assert.equal(advanceSnake([[1,1],[2,1],[2,2],[1,2]],[1,0],[5,5]),null,'Body collision ends the round');
assert.equal(advanceSnake([[1,1],[2,1],[2,2],[1,2]],[0,1],[5,5]).body.length,4,'Moving into vacated tail is valid');
const grown=advanceSnake([[1,1],[0,1]],[1,0],[2,1]);assert.equal(grown.ate,true);assert.equal(grown.body.length,3);
const target=Array.from({length:16},(_,i)=>(i+1)%16);assert.ok(solved(target));assert.equal(moveTile(target,0),null);
assert.ok(solved(moveTile(moveTile(target,14),15)),'A legal move can be undone');
function solvable(board){const values=board.filter(Boolean);let inversions=0;for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)if(values[i]>values[j])inversions++;const rowFromBottom=4-Math.floor(board.indexOf(0)/4);return (inversions+rowFromBottom)%2===1;}
for(let i=0;i<200;i++){const board=shuffleBoard();assert.equal(new Set(board).size,16);assert.ok(!solved(board));assert.ok(solvable(board),'Every shuffled puzzle must be solvable');}
console.log('Snake collisions, growth and vacated-tail movement; 200 solvable sliding puzzles: passed.');

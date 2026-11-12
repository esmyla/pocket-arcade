import assert from 'node:assert/strict';
import {generatePuzzle,rotate,placement} from '../app/games/bag.js';
for(let n=0;n<100;n++){
 const board=Array(30).fill(null),pieces=generatePuzzle(n);
 for(let id=0;id<pieces.length;id++){
  const p=pieces[id],indices=placement(p.cells,...p.home,board);
  assert.ok(indices,`Trip ${n}: original solution must fit`);
  indices.forEach(i=>board[i]=id);
  assert.equal(placement(p.cells,...p.home,board),null,'Overlap must be rejected');
  let shape=p.cells;for(let k=0;k<4;k++)shape=rotate(shape);
  assert.deepEqual(shape,p.cells,'Four rotations preserve the shape');
 }
 assert.ok(board.every(v=>v!==null));
}
assert.equal(placement([[0,0],[1,0]],5,4,Array(30).fill(null)),null,'No wrapping across suitcase edges');
console.log('100 puzzle solutions, full coverage, overlaps, edges and rotations: passed.');

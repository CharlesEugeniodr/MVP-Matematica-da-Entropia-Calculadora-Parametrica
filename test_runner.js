const fs = require('fs');
const modelCode = fs.readFileSync('js/model.js', 'utf8');
eval(modelCode);
const res = StructuralEntropyModel.simulate();
fs.writeFileSync('test_out.txt', 'Final lambda: ' + res.lambda[res.length-1] + '\nContains NaN: ' + Array.from(res.lambda).some(isNaN));

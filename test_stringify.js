const { where } = require('firebase/firestore');
console.log(JSON.stringify(where('a', '==', 'b')));

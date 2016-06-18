import {System} from "./linq.net";
var a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var e = new System.Linq.Enumerable(a);
e.where(item => item % 2 === 0).forEach(item => console.log(item));
var b = e.select(item => { return { num: item, mod: item % 2 } })
         .where(item => item.mod !== 0)
         .select(i => i.num).toArray();

var c = new System.Linq.Enumerable(b).firstOrUndefined();
var d = new System.Linq.Enumerable(b).first(i => i === 3);

var f = new System.Linq.Enumerable(a)
    .select(item => { return { num: item, mod: item % 2 } })
    .where(item => item.mod !== 0)
    .select(i => i.num);

var g = f.where(i => i < 8).toArray();
var h = f.where(i => i > 5).toArray();
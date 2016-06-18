export namespace System {

    export interface IDisposable {
        /**
        * IDisposable is an attempt at helping to solve problems with deterministic
        * finalization.  The GC of course doesn't leave any way to deterministically
        * know when a finalizer will run.  This forces classes that hold onto OS
        * resources or some sort of important state (such as a FileStream or a 
        * network connection) to provide a Close or Dispose method so users can 
        * run clean up code deterministically.  We have formalized this into an 
        * interface with one method.  Classes may privately implement IDisposable and
        * provide a Close method instead, if that name is by far the expected name
        * for objects in that domain (ie, you don't Dispose of a FileStream, you Close
        * it).
        *
        * This interface could be theoretically used as a marker by a compiler to 
        * ensure a disposable object has been cleaned up along all code paths if it's 
        * been allocated in that method, though in practice any compiler that 
        * draconian may tick off any number of people.  Perhaps an external tool (like
        * like Purify or BoundsChecker) could do this.  Instead, C# has added a using 
        * clause, which will generate a try/finally statement where the resource 
        * passed into the using clause will always have it's Dispose method called.  
        * Syntax is using(FileStream fs = ...) { .. };
        *
        * Dispose should meet the following conditions:
        * 1) Be safely callable multiple times
        * 2) Release any resources associated with the instance
        * 3) Call the base class's Dispose method, if necessary
        * 4) Suppress finalization of this class to help the GC by reducing the
        *    number of objects on the finalization queue.
        * 5) Dispose shouldn't generally throw exceptions, except for very serious 
        *    errors that are particularly unexpected. (ie, OutOfMemoryException)  
        *    Ideally, nothing should go wrong with your object by calling Dispose.
        *
        * If possible, a class should define a finalizer that calls Dispose.
        * However, in many situations, this is impractical.  For instance, take the
        * classic example of a Stream and a StreamWriter (which has an internal 
        * buffer of data to write to the Stream).  If both objects are collected 
        * before Close or Dispose has been called on either, then the GC may run the
        * finalizer for the Stream first, before the StreamWriter.  At that point, any
        * data buffered by the StreamWriter cannot be written to the Stream.  In this
        * case, it doesn't make much sense to provide a finalizer on the StreamWriter
        * since you cannot solve this problem correctly.  
        */
        dispose(): void;
    }

    export namespace Collections {
        export namespace Generics {
            export interface IEnumerator<T> {
                /**
                 * Interfaces are not serializable
                 * Advances the enumerator to the next element of the enumeration and
                 * returns a boolean indicating whether an element is available. Upon
                 * creation, an enumerator is conceptually positioned before the first
                 * element of the enumeration, and the first call to next() 
                 * brings the first element of the enumeration into view.
                 */
                next(): boolean;

                /**
                 * Returns the current element of the enumeration. The returned value is
                 * undefined before the first call to next() and following a
                 * call to next() that returned false. Multiple calls to
                 * current() with no intervening calls to next()
                 * will return the same object.
                 */
                current: T;

                /**
                 * Resets the enumerator to the beginning of the enumeration, starting over.
                 * The preferred behavior for Reset is to return the exact same enumeration.
                 * This means if you modify the underlying collection then call Reset, your
                 * IEnumerator will be invalid, just as it would have been if you had called
                 * next or current().
                 */
                //reset(): void;
            }

            export interface IEnumerable<TSource> {
                /**
                 * Returns an IEnumerator for this enumerable Object.
                 * The enumerator provides a simple way to access all the contents of a collection.
                 */
                getEnumerator(): IEnumerator<TSource>;

                where(predicate: (source: TSource) => boolean): IEnumerable<TSource>;
                select<TResult>(selector: (source: TSource) => TResult): IEnumerable<TResult>;
                first(predicate?: (source: TSource) => boolean): TSource;
                firstOrUndefined(predicate?: (source: TSource) => boolean): TSource;
                toArray(): TSource[];
                forEach(callback: (item: TSource) => void): void;
            }
        }
    }

    export namespace Linq {
        function combinePredicates<TSource>(predicate1: (source: TSource) => boolean, predicate2: (source: TSource) => boolean): (source: TSource) => boolean {
            return x => predicate1(x) && predicate2(x);
        }

        function combineSelectors<TSource, TMiddle, TResult>(selector1: (source: TSource) => TMiddle, selector2: (middle: TMiddle) => TResult): (source: TSource) => TResult {
            return x => selector2(selector1(x));
        }

        function toArray<T>(source: Iterator<T>): T[] {
            var array: T[] = [];
            source.forEach(item => array.push(item));
            return array;
        }

        abstract class Iterator<TSource> implements IDisposable, System.Collections.Generics.IEnumerable<TSource>, System.Collections.Generics.IEnumerator<TSource> {
            private _threadId: number = 0;
            protected __state: number = 0;
            protected __current: TSource = undefined;

            constructor() {
                this._threadId = process.pid;
            }

            public abstract clone(): Iterator<TSource>;

            public dispose(): void {
                this.__current = undefined;
                this.__state = -1;
            }

            public getEnumerator(): System.Collections.Generics.IEnumerator<TSource> {
                if (this._threadId == process.pid && this.__state == 0) {
                    this.__state = 1;
                    return this;
                }
                var duplicate: Iterator<TSource> = this.clone();
                duplicate.__state = 1;
                return duplicate;
            }

            get current(): TSource {
                return this.__current;
            }

            public abstract next(): boolean;

            public reset(): void {
                throw new Error("Not Implemented");
            }

            public forEach(callback: (item: TSource) => void): void {
                var enumerator = this.getEnumerator();
                while (enumerator.next()) {
                    callback(enumerator.current);
                }
            }

            public toArray(): TSource[] {
                return toArray(this);
            }

            first(predicate?: (source: TSource) => boolean): TSource{
                var firstOrUndefined = this.firstOrUndefined(predicate);
                if (typeof firstOrUndefined === "undefined") throw Error("Not found");
                return firstOrUndefined;
            }

            firstOrUndefined(predicate?: (source: TSource) => boolean): TSource{
                var enumerator = this.getEnumerator();
                while (enumerator.next()) {
                    if (!predicate || predicate(enumerator.current)) {
                        return enumerator.current;
                    }
                }
                return undefined;
            }

            public abstract select<TResult>(selector: (source: TSource) => TResult): System.Collections.Generics.IEnumerable<TResult>;
            public abstract where<TResult>(predicate: (source: TSource) => boolean): System.Collections.Generics.IEnumerable<TResult>;
        }

        class WhereEnumerableIterator<TSource> extends Iterator<TSource> {
            private _source: System.Collections.Generics.IEnumerable<TSource> = undefined;
            private _predicate: (source: TSource) => boolean = undefined;
            private _enumerator: System.Collections.Generics.IEnumerator<TSource> = undefined;

            constructor(source: System.Collections.Generics.IEnumerable<TSource>, predicate: (source: TSource) => boolean) {
                super();
                this._source = source;
                this._predicate = predicate;
            }

            clone(): Iterator<TSource> {
                return new WhereEnumerableIterator(this._source, this._predicate);
            }

            dispose(): void {
                if (this._enumerator && (<any>this._enumerator).dispose) (<System.IDisposable>(<any>this._enumerator)).dispose();
                this._enumerator = undefined;
                super.dispose();
            }

            next(): boolean {
                switch (this.__state) {
                    case 1:
                        this._enumerator = this._source.getEnumerator();
                        this.__state = 2;
                    case 2:
                        while (this._enumerator.next()) {
                            var item: TSource = this._enumerator.current;
                            if (this._predicate(item)) {
                                this.__current = item;
                                return true;
                            }
                        }
                        this.dispose();
                        break;
                }
                return false;
            }

            select<TResult>(selector: (source: TSource) => TResult): System.Collections.Generics.IEnumerable<TResult> {
                return new WhereSelectEnumerableIterator<TSource, TResult>(this._source, this._predicate, selector);
            }

            where(predicate: (source: TSource) => boolean): System.Collections.Generics.IEnumerable<TSource> {
                return new WhereEnumerableIterator<TSource>(this._source, combinePredicates(this._predicate, predicate));
            }
        }

        class WhereArrayIterator<TSource> extends Iterator<TSource> {
            private _source: TSource[] = undefined;
            private _predicate: (source: TSource) => boolean = undefined;
            private _index: number = 0;

            constructor(source: TSource[], predicate: (source: TSource) => boolean) {
                super();
                this._source = source;
                this._predicate = predicate;
            }

            clone(): Iterator<TSource> {
                return new WhereArrayIterator<TSource>(this._source, this._predicate);
            }

            next(): boolean {
                if (this.__state == 1) {
                    while (this._index < this._source.length) {
                        var item: TSource = this._source[this._index++];
                        if (!this._predicate || this._predicate(item)) {
                            this.__current = item;
                            return true;
                        }
                    }
                    this.dispose();
                }
                return false;
            }

            select<TResult>(selector: (source: TSource) => TResult): System.Collections.Generics.IEnumerable<TResult> {
                return new WhereSelectArrayIterator(this._source, this._predicate, selector);
            }

            where(predicate: (source: TSource) => boolean): System.Collections.Generics.IEnumerable<TSource> {
                return new WhereArrayIterator<TSource>(this._source, combinePredicates(this._predicate, predicate));
            }
        }

        class WhereSelectEnumerableIterator<TSource, TResult> extends Iterator<TResult> {
            private _source: System.Collections.Generics.IEnumerable<TSource> = undefined;
            private _predicate: (source: TSource) => boolean = undefined;
            private _selector: (source: TSource) => TResult = undefined;
            private _enumerator: System.Collections.Generics.IEnumerator<TSource> = undefined;

            constructor(source: System.Collections.Generics.IEnumerable<TSource>, predicate: (source: TSource) => boolean, selector: (source: TSource) => TResult) {
                super();
                this._source = source;
                this._predicate = predicate;
                this._selector = selector;
            }

            clone(): Iterator<TResult> {
                return new WhereSelectEnumerableIterator(this._source, this._predicate, this._selector);
            }

            dispose(): void {
                if (this._enumerator && (<any>this._enumerator).dispose) (<System.IDisposable>(<any>this._enumerator)).dispose();
                this._enumerator = undefined;
                super.dispose();
            }

            next(): boolean {
                switch (this.__state) {
                    case 1:
                        this._enumerator = this._source.getEnumerator();
                        this.__state = 2;
                    case 2:
                        while (this._enumerator.next()) {
                            var item: TSource = this._enumerator.current;
                            if (!this._predicate || this._predicate(item)) {
                                this.__current = this._selector(item);
                                return true;
                            }
                        }
                        this.dispose();
                        break;
                }
                return false;
            }

            select<TResult2>(selector: (source: TResult) => TResult2): System.Collections.Generics.IEnumerable<TResult2> {
                return new WhereSelectEnumerableIterator<TSource, TResult2>(this._source, this._predicate, combineSelectors(this._selector, selector));
            }

            where(predicate: (source: TResult) => boolean): System.Collections.Generics.IEnumerable<TResult> {
                return new WhereEnumerableIterator<TResult>(this, predicate);
            }
        }

        class WhereSelectArrayIterator<TSource, TResult> extends Iterator<TResult> {
            private _source: TSource[] = undefined;
            private _predicate: (source: TSource) => boolean = undefined;
            private _selector: (source: TSource) => TResult = undefined;
            private _index: number = 0;

            constructor(source: TSource[], predicate: (source: TSource) => boolean, selector: (source: TSource) => TResult) {
                super();
                this._source = source;
                this._predicate = predicate;
                this._selector = selector;
            }

            clone(): Iterator<TResult> {
                return new WhereSelectArrayIterator<TSource, TResult>(this._source, this._predicate, this._selector);
            }

            next(): boolean {
                if (this.__state == 1) {
                    while (this._index < this._source.length) {
                        var item: TSource = this._source[this._index++];
                        if (!this._predicate || this._predicate(item)) {
                            this.__current = this._selector(item);
                            return true;
                        }
                    }
                    this.dispose();
                }
                return false;
            }

            select<TResult2>(selector: (source: TResult) => TResult2): System.Collections.Generics.IEnumerable<TResult2> {
                return new WhereSelectArrayIterator<TSource, TResult2>(this._source, this._predicate, combineSelectors(this._selector, selector));
            }

            where(predicate: (source: TResult) => boolean): System.Collections.Generics.IEnumerable<TResult> {
                return new WhereEnumerableIterator<TResult>(this, predicate);
            }
        }

        export class Enumerable<TSource> implements System.Collections.Generics.IEnumerable<TSource>{
            constructor(source: TSource[]) {
                this.getSource = () => source;
            }

            private getSource(): TSource[] {
                return undefined;
            }

            public getEnumerator(): System.Collections.Generics.IEnumerator<TSource> {
                return new WhereArrayIterator(this.getSource(), null).getEnumerator();
            }

            public where(predicate: (source: TSource) => boolean): System.Collections.Generics.IEnumerable<TSource> {
                return new WhereArrayIterator(this.getSource(), predicate);
            }

            public select<TResult>(selector: (source: TSource) => TResult): System.Collections.Generics.IEnumerable<TResult> {
                return new WhereSelectArrayIterator<TSource, TResult>(this.getSource(), null, selector);
            }

            first(predicate?: (source: TSource) => boolean): TSource{
                return new WhereArrayIterator(this.getSource(), predicate).first();                
            }

            firstOrUndefined(predicate?: (source: TSource) => boolean): TSource{
                return new WhereArrayIterator(this.getSource(), predicate).firstOrUndefined();
            }

            public forEach(callback: (item: TSource) => void): void {
                this.getSource().forEach(item => callback(item));
            }

            public toArray(): TSource[] {
                return this.getSource();
            }
        }
    }
}
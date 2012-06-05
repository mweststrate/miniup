package nl.mweststrate.miniup.util;

/**
 * A pair of things, useful in a language that doesn't contain tuples...
 * 
 * Probably grabbed it from somewhere of the internetz..
 * 
 * @author michel
 *
 * @param <A>
 * @param <B>
 */
public class Pair<A, B> {
    private final A first;
    private final B second;

    public Pair(A first, B second) {
        this.first = first;
        this.second = second;
    }
    
    public static <C, D> Pair<C, D> pair(C first, D second) {
		return new Pair<C,D>(first, second);    	
    }

    public int hashCode() {
        int hashFirst = first != null ? first.hashCode() : 0;
        int hashSecond = second != null ? second.hashCode() : 0;

        return (hashFirst + hashSecond) * hashSecond + hashFirst;
    }

    @SuppressWarnings("unchecked")
	public boolean equals(Object other) {
        if (other instanceof Pair) {
                Pair<A, B> otherPair = (Pair<A,B>) other;
                return 
                ((  this.first == otherPair.first ||
                        ( this.first != null && otherPair.first != null &&
                          this.first.equals(otherPair.first))) &&
                 (      this.second == otherPair.second ||
                        ( this.second != null && otherPair.second != null &&
                          this.second.equals(otherPair.second))) );
        }

        return false;
    }

    public String toString()
    { 
           return "(" + first + ", " + second + ")"; 
    }

    public A getFirst() {
        return first;
    }

    public B getSecond() {
        return second;
    }
    
    public Pair<A, B> clone() {
    	return Pair.pair(first, second);
    }
}
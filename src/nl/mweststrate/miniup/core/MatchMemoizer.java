package nl.mweststrate.miniup.core;

import java.util.HashMap;
import java.util.Map;

import nl.mweststrate.miniup.Miniup;
import nl.mweststrate.miniup.matcher.AbstractMatcher;
import nl.mweststrate.miniup.matcher.TokenMatcher;

public class MatchMemoizer {
	int cachehits = 0;
	int cachemisses = 0;
	
	Map<Integer, Map<String, Match>> matchCache = new HashMap<Integer, Map<String, Match>>();
	
    boolean isInCache(int curpos, AbstractMatcher matcher) {
    	if (!Miniup.USE_TOKEN_MEMOIZATION)
    		return false;
    	
    	boolean res = matcher instanceof TokenMatcher;
    	
    	if (res) {
    		if (!matchCache.containsKey(curpos)) {
    			matchCache.put(curpos, new HashMap<String,Match>());
    			res = false; //appearantly, it is not in cache :)
    		}
    		else
    			res = matchCache.get(curpos).containsKey(matcher.getName());
    	}
    	
    	if (res)
    		cachehits +=1;
    	else
    		cachemisses += 1;
    	return res;    	
    }
    
	boolean consumeFromCache(Match parent, String token, int curpos) {
		Match catched = matchCache.get(curpos).get(token);
		if (catched != null) {
			parent.register(catched);
			return true;
		}
		return false;
	}

	void storeInCache(Match parent, int curpos,	AbstractMatcher matcher) {
    	if (!Miniup.USE_TOKEN_MEMOIZATION)
    		return;
    	
		if (matcher instanceof TokenMatcher)
			matchCache.get(curpos).put(matcher.getName(), 
					parent == null 
							? null                //not a match
							: parent.lastChild()  //match
					);
	}

}

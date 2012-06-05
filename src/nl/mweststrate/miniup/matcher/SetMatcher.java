package nl.mweststrate.miniup.matcher;

import java.util.Arrays;
import java.util.List;
import java.util.Vector;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;


public class SetMatcher extends AbstractMatcher {

    private String seperator;
    private List<String> items;
    private String pre;
    private String post;

    public SetMatcher(Grammar language, String name, String seperatorOrNull, String preOrNull, String postOrNull, String... items) {
        super(language, name);
        this.seperator = seperatorOrNull;
        this.pre = preOrNull;
        this.post = postOrNull;
        this.items = Arrays.asList(items);
    }

    @Override
    boolean performMatch(Parser parser, Match parent)
            throws ParseException {
        if (pre != null && !parser.consume(parent, pre))
            return false;
        
        List<String> available = new Vector<String>(items);
        boolean matched = true;
        boolean sepmatched = false;
        while(!available.isEmpty() && matched) {
            matched = false;
            for(String token : available) {
                if (parser.consume(parent, token)) {
                    available.remove(token);
                    matched = true;
                    if (seperator == null)
                        break;
                    else
                        sepmatched = parser.consume(parent, seperator);
                }
            }
        }
        if (sepmatched) //there was a trailing seperator!
            return false;
        
        return post == null || parser.consume(parent, post);
    }

    @Override
    public Node toAST(Match match) {
        List<Node> children = new Vector<Node>();
        boolean hasPre = pre != null;
        boolean hasSep = seperator != null;
        boolean hasPost = post != null;
        for(int i = 0; i < match.subMatchCount(true); i++){
            if (i == 0 && hasPre)
                continue;
            if (i == match.subMatchCount(true) -1 && hasPost)
                continue;
            if (hasSep && i % 2 == (hasPre ? 0 : 1))
                continue;
            children.add(match.getSubMatch(i, true).toAST());
        }
        return new Node(this.name, children );
    }
}

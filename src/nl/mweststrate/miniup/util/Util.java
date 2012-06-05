package nl.mweststrate.miniup.util;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.util.Collection;

/**
 * Some utility functions used by the parsers. You might find similar methods, probably faster, in apache commons.
 * Those are here just to make the parser dependency free.
 * @author michel
 *
 */
public class Util {
	
	/**
	 * Given a filename, returns it contents as string
	 * @param filePath
	 * @return
	 * @throws java.io.IOException
	 */
	public static String readFileAsString(String filePath) throws java.io.IOException{
        byte[] buffer = new byte[(int) new File(filePath).length()];
        BufferedInputStream f = new BufferedInputStream(new FileInputStream(filePath));
        f.read(buffer);
        return new String(buffer);
    }
	
	/**
	 * If idx is positive, returns the substring starting at the index, otherwise, return the substring ending at that index
	 * @param base
	 * @param idx
	 * @return
	 */
	public static String substring(String base, int idx) {
		if (idx >= 0)
			return substring(base, idx, 0);
		return substring(base, 0, idx);
	}
	
	/**
	 * Substring implementation that never throws an exception and can work with negative ranges, example:
	 * 
	 * if input: "miniup"
	 * 
	 * 0 (,0)  -> "miniup"
	 * 2 (,0)  -> "niup"
	 * 4, 2    -> "up"
	 * (0,) -2 -> "mini"
	 * 1, -2   -> "ini"
	 * -1, -2  -> "i"
	 * -1, 6   -> "p"
	 * @param base basestring to get a substring from
	 * @param fromleft if positive, start index; if negative, string length
	 * @param fromright if negative, amount of characters from the end, if positive, string length
	 * @return
	 */
	public static String substring(String base, int fromidx, int toidx) {
		int from = fromidx;
		int len  = base.length();
		int to = toidx;
		
		if (from == 0 && to == 0) 
			to = len;
		else if (from >= 0 && to <= 0) 
			to = len + to;
		else if (from >= 0 && to > 0)
			to = from + to;
		else if (from < 0 && to < 0) {
			to = len + to;
			from = to + from;
		}
		else if (from < 0 && to >= 0) 
			from = to + from;
		else
			throw new RuntimeException("Unimplemented substring case: " + fromidx + ", " + toidx);
			
		from = Math.max(from, 0);
		to   = Math.max(from, Math.min(to, len));
		
		return base.substring(from, to);
	}
	
	public static String leftPad(String string, int col) {
		int v = col;
		String r = "";
		while (v-- > 0)
			r += " ";
		return r + string;
	}

	public static String join(Collection<String> stuff, String separator) {
		StringBuilder b = new StringBuilder();
		int i = 0;
		for(String item : stuff) {
			b.append(item);
			if (i < stuff.size() -1)
				b.append(separator);
			i++;
		}
		return b.toString();
	}

	public static int countMatches(String input, String needle) {
		int r = 0;
		int p = 0;
		int i = 0;
		while((i = input.indexOf(needle, p)) != -1) {
			p = i + 1;
			r++;
		}
		return r;
	}

	public static String unescape(String text) {
    	//naive unescape function..
    	return text.replaceAll("\\\b", "\b")
        	.replaceAll("\\\t",  "\t")
        	.replaceAll("\\\n",  "\n")
        	.replaceAll("\\\f",  "\f")
        	.replaceAll("\\\r",  "\r")
        	.replaceAll("\\\\", "\\")
        	.replaceAll("\\'",  "'")
        	.replaceAll("\\\"", "\"");
	}


	public static String trimToLength(String string, int maxlength) {
		if (string == null || string.length() < maxlength)
			return string;
		return string.substring(0, maxlength);
	}
	
	public static String getInputLineByPos(String input, int position) {
		int prev = input.lastIndexOf('\n', position);
    	int next = input.indexOf('\n', position);
    	String line = Util.substring(input, prev +1 , Math.min(position + 20, next - prev));
    	return line.replaceAll("\t", " ");
	}
	
	public static String getInputLine(String input, int nr) {
		int cur = -1;
		for(int i = nr; i > 1; i--) {
			cur = input.indexOf('\n', cur +1);
			if (cur == -1)
				return null;					
		}
		
		int next = input.indexOf('\n', cur +1);
		String line;
		if (next == -1)
			line = input.substring(cur +1);
		else
			line = input.substring(cur +1, next);
		
		return line.replaceAll("\t", " "); //to fix highlighting for tabs. Better would be to insert a tabs before the cursor if needed
	}

	public static String hightlightLine(String inputString, int linenr,
			int colnr) {
		String msg = "at line " + linenr + " column " + colnr + ":\n\n";
		msg += getInputLine(inputString, linenr) + "\n"; 
    	msg += Util.leftPad("^", colnr -1);
		return msg;
	}
}

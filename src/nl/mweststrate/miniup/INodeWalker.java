package nl.mweststrate.miniup;

/**
 * This interface can be passed to @see Node.walk,
 * which traverses the Node tree in depth first order, calling @see hit for each Node it encounters.
 * @author michel
 *
 */
public interface INodeWalker {
	/**
	 * Event which is called when the walker encounters a node. Should return true if the walker is allowed to continue, or false if it should break
	 * @param node
	 * @return
	 */
	boolean hit(Node node);
}


function renderStateDiagramSVG(transitions, options = {}) {
    const {
        containerId = 'diagram',
        rankdir = 'LR', // 'LR' (left-right), 'TB' (top-bottom)
        nodePadding = 20,
        fontSize = 14,
        nodeFill = '#4A90E2',
        textFill = '#fff',
        edgeStroke = '#333',
        edgeWidth = 2,
        arrowSize = 10,
        cornerRadius = 8,
        marginx = 50,
        marginy = 50
    } = options;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir, marginx, marginy });
    g.setDefaultEdgeLabel(() => ({}));

    const allNodes = [...new Set(transitions.flatMap(t => [t.from, t.to]))];
    allNodes.forEach(label => {
        const width = label.length * fontSize * 0.6 + nodePadding * 2;
        const height = fontSize + nodePadding;
        g.setNode(label, { label, width, height });
    });

    transitions.forEach(({ from, to }) => {
        g.setEdge(from, to);
    });

    dagre.layout(g);

    const svg = document.getElementById(containerId);
    while (svg.firstChild) svg.removeChild(svg.firstChild); // 清空舊內容

    const padding = 20;
    const maxX = Math.max(...allNodes.map(n => g.node(n).x + g.node(n).width / 2)) + padding;
    const maxY = Math.max(...allNodes.map(n => g.node(n).y + g.node(n).height / 2)) + padding;
    svg.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Arrow marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
    <marker id="arrow" markerWidth="${arrowSize}" markerHeight="${arrowSize}" refX="${arrowSize / 2}" refY="${arrowSize / 2}" orient="auto">
      <path d="M0,0 L${arrowSize},${arrowSize / 2} L0,${arrowSize} Z" fill="${edgeStroke}" />
    </marker>
  `;
    svg.appendChild(defs);

    // Draw edges
    g.edges().forEach(e => {
        const edge = g.edge(e);
        const points = edge.points;
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', edgeStroke);
        polyline.setAttribute('stroke-width', edgeWidth);
        polyline.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(polyline);
    });

    // Draw nodes
    allNodes.forEach(label => {
        const node = g.node(label);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', node.x - node.width / 2);
        rect.setAttribute('y', node.y - node.height / 2);
        rect.setAttribute('width', node.width);
        rect.setAttribute('height', node.height);
        rect.setAttribute('rx', cornerRadius);
        rect.setAttribute('fill', nodeFill);
        group.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y + fontSize / 3);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', fontSize);
        text.setAttribute('fill', textFill);
        text.textContent = label;
        group.appendChild(text);

        svg.appendChild(group);
    });
}
const transitions = [
    { from: 'Start', to: 'Login' },
    { from: 'Login', to: 'Dashboard' },
    { from: 'Dashboard', to: 'Settings' },
    { from: 'Dashboard', to: 'Profile' },
    { from: 'Settings', to: 'Logout' },
    { from: 'Profile', to: 'Logout' },
    { from: 'Logout', to: 'Start' }
];

renderStateDiagramSVG(transitions, {
    containerId: 'diagram',
    rankdir: 'LR',
    nodePadding: 50,
    fontSize: 12,
    nodeFill: '#4A90E2',
    textFill: '#fff',
    edgeStroke: '#333',
    edgeWidth: 2,
    arrowSize: 10,
    cornerRadius: 8,
    marginx: 50,
    marginy: 50
});


    // <div id="diagram-container">
    //     <svg id="diagram" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg>
    // </div>

    
        // #diagram-container {
        //     width: 100%;
        //     height: 100vh;
        //     background: #f0f0f0;
        // }

        // svg {
        //     width: 100%;
        //     height: 100%;
        // }
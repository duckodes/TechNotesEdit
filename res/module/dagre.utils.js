const dagreUtils = (() => {
    /** @type {[{ from: string, to: string }]} */
    const transitions = [
        { from: '', to: '' } // ← 這裡會跳出提示
    ];

    /**
     * 根據狀態轉換渲染流程圖
     * 
     * @param {transitions} transitions 狀態轉換的陣列，每個物件代表一個節點連接
     * @param {Object} options 渲染選項
     * @param {HTMLElement} [options.parent=document.body] 要插入圖形的父元素
     * 
     * @param {'LR'|'TB'} [options.dir='LR'] 排列方向：'LR' 從左到右，'TB' 從上到下
     * 
     * @param {number} [options.nodePadding=20] 節點內部間距
     * @param {string} [options.nodeBackground='none'] 節點背景色
     * @param {string} [options.nodeStroke='#aaa'] 節點邊框顏色
     * @param {number} [options.nodeStrokeWidth=1] 節點邊框寬度
     * @param {number} [options.nodeRadius=5] 節點圓角半徑
     * @param {string} [options.nodeTextColor='#aaa'] 節點文字顏色
     * @param {number} [options.nodefontSize=14] 節點文字大小
     * 
     * @param {string} [options.arrowColor='#ddd'] 箭頭顏色
     * @param {number} [options.arrowWidth=2] 箭頭線寬
     * @param {number} [options.arrowSize=10] 箭頭大小
     * @param {number} [options.arrowStartOffset=0] 箭頭起始偏移
     * @param {number} [options.arrowEndOffset=0] 箭頭結束偏移
     * 
     * @param {number} [options.marginX=50] 圖形左右邊距
     * @param {number} [options.marginY=50] 圖形上下邊距
     */
    function render(transitions, {
        appendParent = false,
        parent = document.body,

        size = '',
        dir = 'LR',

        nodePadding = 20,
        nodefontSize = 14,
        nodeBackground = 'none',
        nodeStroke = '#aaa',
        nodeStrokeWidth = 1,
        nodeRadius = 5,
        nodeTextColor = '#aaa',

        arrowColor = '#ddd',
        arrowWidth = 2,
        arrowSize = 10,
        arrowStartOffset = 0,
        arrowEndOffset = 0,

        marginX = 50,
        marginY = 50
    }) {
        const diagramContainer = document.createElement('div');
        diagramContainer.className = 'diagram-container';
        diagramContainer.style.maxWidth = size;

        const diagramSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        diagramSvg.setAttribute('class', 'diagram');
        diagramSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        diagramSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        diagramContainer.appendChild(diagramSvg);

        if (appendParent) parent.appendChild(diagramContainer);

        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: dir, marginX, marginY });
        g.setDefaultEdgeLabel(() => ({}));

        const allNodes = [...new Set(transitions.flatMap(t => [t.from, t.to]))];
        const nodeTypes = {};
        transitions.forEach(({ from, to, type }) => {
            if (type) {
                nodeTypes[from] = type;
                nodeTypes[to] = type;
            }
        });

        allNodes.forEach(label => {
            const width = label.length * nodefontSize * 0.6 + nodePadding * 2;
            const height = nodefontSize + nodePadding;
            g.setNode(label, { label, width, height });
        });

        transitions.forEach(({ from, to }) => {
            g.setEdge(from, to);
        });

        dagre.layout(g);

        while (diagramSvg.firstChild) diagramSvg.removeChild(diagramSvg.firstChild);

        const padding = 50;
        const maxX = Math.max(...allNodes.map(n => g.node(n).x + g.node(n).width / 2)) + padding;
        const maxY = Math.max(...allNodes.map(n => g.node(n).y + g.node(n).height / 2)) + padding;
        diagramSvg.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);

        // Arrow marker
        const markerId = `arrow-${Date.now()}`;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
<marker id="${markerId}" markerWidth="${arrowSize}" markerHeight="${arrowSize}" refX="${arrowSize / 2}" refY="${arrowSize / 2}" orient="auto">
<path d="M0,0 L${arrowSize},${arrowSize / 2} L0,${arrowSize} Z" fill="${arrowColor}" />
</marker>`;
        diagramSvg.appendChild(defs);

        // Draw edges
        g.edges().forEach(e => {
            const edge = g.edge(e);
            const points = edge.points;
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
            polyline.setAttribute('fill', 'none');
            polyline.setAttribute('stroke', arrowColor);
            polyline.setAttribute('stroke-width', arrowWidth);
            polyline.setAttribute('marker-end', `url(#${markerId})`);

            const first = points[0], second = points[1];
            const dxStart = second.x - first.x, dyStart = second.y - first.y;
            const lenStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
            const newFirst = {
                x: first.x + (dxStart / lenStart) * arrowStartOffset,
                y: first.y + (dyStart / lenStart) * arrowStartOffset
            };

            const last = points[points.length - 1], secondLast = points[points.length - 2];
            const dx = last.x - secondLast.x, dy = last.y - secondLast.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const newLast = {
                x: last.x - (dx / len) * (arrowEndOffset + 10),
                y: last.y - (dy / len) * (arrowEndOffset + 10)
            };

            const adjustedPoints = [newFirst, ...points.slice(1, -1), newLast];
            polyline.setAttribute('points', adjustedPoints.map(p => `${p.x},${p.y}`).join(' '));
            diagramSvg.appendChild(polyline);
        });

        // Draw nodes
        allNodes.forEach(label => {
            const node = g.node(label);
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const type = nodeTypes[label] || 'process';

            let shapeElement;

            switch (type) {
                case 'start':
                case 'end':
                    shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                    shapeElement.setAttribute('cx', node.x);
                    shapeElement.setAttribute('cy', node.y);
                    shapeElement.setAttribute('rx', node.width / 2);
                    shapeElement.setAttribute('ry', node.height / 2);
                    break;

                case 'decision':
                    shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    shapeElement.setAttribute('points', [
                        `${node.x},${node.y - node.height / 2}`,
                        `${node.x + node.width / 2},${node.y}`,
                        `${node.x},${node.y + node.height / 2}`,
                        `${node.x - node.width / 2},${node.y}`
                    ].join(' '));
                    break;

                case 'input':
                case 'output':
                    shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    shapeElement.setAttribute('points', [
                        `${node.x - node.width / 2 + 10},${node.y - node.height / 2}`,
                        `${node.x + node.width / 2},${node.y - node.height / 2}`,
                        `${node.x + node.width / 2 - 10},${node.y + node.height / 2}`,
                        `${node.x - node.width / 2},${node.y + node.height / 2}`
                    ].join(' '));
                    break;

                case 'data':
                    shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    shapeElement.setAttribute('d', `
            M ${node.x - node.width / 2} ${node.y - node.height / 2}
            a ${node.width / 2} ${node.height / 4} 0 0 1 ${node.width} 0
            v ${node.height / 2}
            a ${node.width / 2} ${node.height / 4} 0 0 1 -${node.width} 0
            Z
          `);
                    break;

                default:
                    shapeElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    shapeElement.setAttribute('x', node.x - node.width / 2);
                    shapeElement.setAttribute('y', node.y - node.height / 2);
                    shapeElement.setAttribute('width', node.width);
                    shapeElement.setAttribute('height', node.height);
                    shapeElement.setAttribute('rx', nodeRadius);
            }

            shapeElement.setAttribute('fill', nodeBackground);
            shapeElement.setAttribute('stroke', nodeStroke);
            shapeElement.setAttribute('stroke-width', nodeStrokeWidth);
            group.appendChild(shapeElement);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y + nodefontSize / 3);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', nodefontSize);
            text.setAttribute('fill', nodeTextColor);
            text.textContent = label;
            group.appendChild(text);

            diagramSvg.appendChild(group);
        });

        return diagramContainer.outerHTML;
    }
    return {
        render: render
    }
})();

export default dagreUtils;
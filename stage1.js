// stage1.js

class Node {
    constructor(x, y, floor) {
        this.x = x;
        this.y = y;
        this.floor = floor;
        this.edges = {}; // Соседи: { "x,y,floor": true }
        this.stairs = { up: false, down: false };
        this.isStart = false;
        this.isFinish = false;
    }

    get id() { return `${this.x},${this.y},${this.floor}`; }
    get edgeCount() { return Object.keys(this.edges).length; }
}

class MazeGenerator {
    constructor(width, height, floors) {
        this.width = width;
        this.height = height;
        this.floors = floors;
        this.nodes = [];
        this.startNode = null;
        this.finishNode = null;
        
        this.initNodes();
    }

    initNodes() {
        this.nodes = [];
        for (let f = 0; f < this.floors; f++) {
            let floorNodes = [];
            for (let y = 0; y < this.height; y++) {
                let row = [];
                for (let x = 0; x < this.width; x++) {
                    row.push(new Node(x, y, f));
                }
                floorNodes.push(row);
            }
            this.nodes.push(floorNodes);
        }
    }

    getNode(x, y, f) {
        if (f >= 0 && f < this.floors && y >= 0 && y < this.height && x >= 0 && x < this.width) {
            return this.nodes[f][y][x];
        }
        return null;
    }

    getNeighbors(node) {
        let neighbors = [];
        const { x, y, floor } = node;
        
        // 6 направлений для треугольной сетки
        const dirs = [
            [1, 0], [-1, 0], 
            [0, 1], [0, -1],
            // Диагонали зависят от четности строки
            y % 2 === 0 ? [1, 1] : [-1, 1],
            y % 2 === 0 ? [-1, -1] : [1, -1]
        ];

        for (let [dx, dy] of dirs) {
            let n = this.getNode(x + dx, y + dy, floor);
            if (n) neighbors.push(n);
        }
        return neighbors;
    }

    connect(n1, n2) {
        n1.edges[n2.id] = true;
        n2.edges[n1.id] = true;
    }

    hasEdge(n1, n2) {
        return n1.edges[n2.id] === true;
    }

    // 1. Остовное дерево (Алгоритм Прима)
    generateSpanningTree(floor) {
        let visited = new Set();
        let startNode = this.getNode(0, 0, floor);
        visited.add(startNode.id);
        
        let frontier = [];
        for (let n of this.getNeighbors(startNode)) {
            frontier.push({ from: startNode, to: n });
        }

        while (frontier.length > 0) {
            let idx = Math.floor(Math.random() * frontier.length);
            let edge = frontier.splice(idx, 1)[0];
            
            if (!visited.has(edge.to.id)) {
                visited.add(edge.to.id);
                this.connect(edge.from, edge.to);
                
                for (let n of this.getNeighbors(edge.to)) {
                    if (!visited.has(n.id)) {
                        frontier.push({ from: edge.to, to: n });
                    }
                }
            }
        }
    }

    // 2. Добавление циклов
    addCycles(floor, percent) {
        let allPossible = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let node = this.getNode(x, y, floor);
                for (let n of this.getNeighbors(node)) {
                    if (!this.hasEdge(node, n)) {
                        allPossible.push({ from: node, to: n });
                    }
                }
            }
        }
        
        // Убираем дубликаты
        let unique = [];
        let seen = new Set();
        for (let e of allPossible) {
            let key = [e.from.id, e.to.id].sort().join('-');
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(e);
            }
        }

        this.shuffle(unique);
        let targetCount = Math.floor(unique.length * (percent / 100));
        for (let i = 0; i < targetCount; i++) {
            this.connect(unique[i].from, unique[i].to);
        }
    }

    // 3. Добавление лестниц
    addStairs(floor1, floor2, percent) {
        let validNodes = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let n1 = this.getNode(x, y, floor1);
                let n2 = this.getNode(x, y, floor2);
                // Лестница только если есть коридоры на обоих этажах
                if (n1.edgeCount > 0 && n2.edgeCount > 0) {
                    validNodes.push(n1);
                }
            }
        }

        this.shuffle(validNodes);
        let targetCount = Math.floor(validNodes.length * (percent / 100));
        for (let i = 0; i < targetCount; i++) {
            let n1 = validNodes[i];
            let n2 = this.getNode(n1.x, n1.y, floor2);
            n1.stairs.up = true;
            n2.stairs.down = true;
        }
    }

    // 4. Разрывность (Замена ребер для создания локальных разрывов)
    applyDisconnection(floor, percent) {
        // Находим все ребра
        let edges = [];
        let seen = new Set();
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let node = this.getNode(x, y, floor);
                for (let nId in node.edges) {
                    let key = [node.id, nId].sort().join('-');
                    if (!seen.has(key)) {
                        seen.add(key);
                        edges.push({ from: node, to: this.nodes[floor][parseInt(nId.split(',')[1])][parseInt(nId.split(',')[0])] });
                    }
                }
            }
        }

        this.shuffle(edges);
        let swaps = Math.floor(edges.length * (percent / 100));
        
        for (let i = 0; i < swaps; i++) {
            let e = edges[i];
            // Удаляем ребро
            delete e.from.edges[e.to.id];
            delete e.to.edges[e.from.id];
            
            // Ищем случайное свободное место для нового ребра
            let allPossible = [];
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let node = this.getNode(x, y, floor);
                    for (let n of this.getNeighbors(node)) {
                        if (!this.hasEdge(node, n)) {
                            allPossible.push({ from: node, to: n });
                        }
                    }
                }
            }
            if (allPossible.length > 0) {
                let newE = allPossible[Math.floor(Math.random() * allPossible.length)];
                this.connect(newE.from, newE.to);
            }
        }
    }

    // 5. Размещение Старта и Финиша
    placeStartFinish() {
        // BFS для поиска компонент связности
        let visited = new Set();
        let components = [];

        for (let f = 0; f < this.floors; f++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let node = this.getNode(x, y, f);
                    if (!visited.has(node.id) && node.edgeCount > 0) {
                        let comp = [];
                        let queue = [node];
                        visited.add(node.id);
                        
                        while (queue.length > 0) {
                            let curr = queue.shift();
                            comp.push(curr);
                            
                            // Соседи по этажу
                            for (let nId in curr.edges) {
                                let [nx, ny, nf] = nId.split(',').map(Number);
                                let n = this.getNode(nx, ny, nf);
                                if (n && !visited.has(n.id)) {
                                    visited.add(n.id);
                                    queue.push(n);
                                }
                            }
                            // Соседи по лестницам
                            if (curr.stairs.up) {
                                let n = this.getNode(curr.x, curr.y, curr.floor + 1);
                                if (n && !visited.has(n.id)) {
                                    visited.add(n.id);
                                    queue.push(n);
                                }
                            }
                            if (curr.stairs.down) {
                                let n = this.getNode(curr.x, curr.y, curr.floor - 1);
                                if (n && !visited.has(n.id)) {
                                    visited.add(n.id);
                                    queue.push(n);
                                }
                            }
                        }
                        components.push(comp);
                    }
                }
            }
        }

        // Берем самую большую компоненту
        components.sort((a, b) => b.length - a.length);
        if (components.length === 0) return;
        
        let mainComp = components[0];
        this.startNode = mainComp[0];
        this.finishNode = mainComp[mainComp.length - 1];
        
        this.startNode.isStart = true;
        this.finishNode.isFinish = true;
    }

    generate(settings) {
        this.initNodes();
        
        // 1. Остовные деревья
        for (let f = 0; f < this.floors; f++) {
            this.generateSpanningTree(f);
        }
        
        // 2. Циклы и разрывность
        for (let f = 0; f < this.floors; f++) {
            this.addCycles(f, settings.floors[f].cycles);
            this.applyDisconnection(f, settings.floors[f].disconnection);
        }
        
        // 3. Лестницы
        for (let f = 0; f < this.floors - 1; f++) {
            this.addStairs(f, f + 1, settings.stairs[f]);
        }
        
        // 4. Старт и Финиш
        this.placeStartFinish();
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// ==================== РЕНДЕР И UI (ЭТАП 1) ====================

let currentMaze = null;
let currentFloor = 0;

function renderMazeConsole(maze, floor) {
    let output = `<span class="floor-title">===Этаж ${floor}===</span>\n`;
    
    for (let y = 0; y < maze.height; y++) {
        let nodeLine = "";
        let edgeLine = "";
        
        for (let x = 0; x < maze.width; x++) {
            let node = maze.getNode(x, y, floor);
            let nodeChar = "●";
            let nodeClass = "";
            
            if (node.isStart) { nodeChar = "S"; nodeClass = "start"; }
            else if (node.isFinish) { nodeChar = "F"; nodeClass = "finish"; }
            else if (node.stairs.up && node.stairs.down) { nodeChar = "⭥"; nodeClass = "stair"; }
            else if (node.stairs.up) { nodeChar = "↑"; nodeClass = "stair"; }
            else if (node.stairs.down) { nodeChar = "↓"; nodeClass = "stair"; }
            
            nodeLine += `<span class="${nodeClass}">${nodeChar}</span>`;
            
            // Горизонтальные ребра
            if (x < maze.width - 1) {
                let rightNode = maze.getNode(x + 1, y, floor);
                nodeLine += maze.hasEdge(node, rightNode) ? " - " : "   ";
            }
        }
        
        output += nodeLine + "\n";
        
        // Диагональные ребра (между строками)
        if (y < maze.height - 1) {
            let diagLine = "";
            for (let x = 0; x < maze.width; x++) {
                let node = maze.getNode(x, y, floor);
                
                // Левая диагональ
                let leftTarget = (y % 2 === 0) ? maze.getNode(x, y + 1, floor) : maze.getNode(x - 1, y + 1, floor);
                let leftChar = " ";
                if (leftTarget && maze.hasEdge(node, leftTarget)) {
                    leftChar = (y % 2 === 0) ? "\\" : "/";
                }
                
                // Правая диагональ
                let rightTarget = (y % 2 === 0) ? maze.getNode(x + 1, y + 1, floor) : maze.getNode(x, y + 1, floor);
                let rightChar = " ";
                if (rightTarget && maze.hasEdge(node, rightTarget)) {
                    rightChar = (y % 2 === 0) ? "/" : "\\";
                }
                
                diagLine += leftChar + " " + rightChar + " ";
            }
            output += diagLine + "\n";
        }
    }
    
    return output;
}

function updateHUD(maze) {
    if (!maze || !maze.startNode) return;
    
    document.getElementById('hudStart').textContent = `${maze.startNode.x},${maze.startNode.y},${maze.startNode.floor}`;
    document.getElementById('hudFinish').textContent = `${maze.finishNode.x},${maze.finishNode.y},${maze.finishNode.floor}`;
    
    // Простая евклидова дистанция для HUD (в Этапе 1 BFS не обязателен для вывода, но можно добавить)
    let dx = maze.finishNode.x - maze.startNode.x;
    let dy = maze.finishNode.y - maze.startNode.y;
    let df = maze.finishNode.floor - maze.startNode.floor;
    let dist = Math.sqrt(dx*dx + dy*dy + df*df).toFixed(2);
    
    document.getElementById('hudDist').textContent = dist;
    document.getElementById('hudMetric').textContent = document.getElementById('setMetric').value;
    document.getElementById('hudFloor').textContent = `${currentFloor + 1} / ${maze.floors}`;
}

function generateDynamicSettings() {
    let floors = parseInt(document.getElementById('setFloors').value);
    let container = document.getElementById('dynamicSettings');
    container.innerHTML = '';
    
    for (let i = 0; i < floors; i++) {
        let html = `
            <h3>Этаж ${i + 1}</h3>
            <div class="setting-group">
                <div class="setting-row">
                    <span>% покрытия ребрами:</span>
                    <input type="number" class="set-edge" data-floor="${i}" value="100" min="0" max="100">
                </div>
                <div class="setting-row">
                    <span>% покрытия циклами:</span>
                    <input type="number" class="set-cycle" data-floor="${i}" value="20" min="0" max="100">
                </div>
                <div class="setting-row">
                    <span>% разрывности:</span>
                    <input type="number" class="set-disc" data-floor="${i}" value="10" min="0" max="100">
                </div>
            </div>
        `;
        container.innerHTML += html;
    }
    
    for (let i = 0; i < floors - 1; i++) {
        let html = `
            <h3>Лестницы ${i + 1}↔${i + 2}</h3>
            <div class="setting-group">
                <div class="setting-row">
                    <span>% покрытия:</span>
                    <input type="number" class="set-stair" data-pair="${i}" value="30" min="0" max="100">
                </div>
            </div>
        `;
        container.innerHTML += html;
    }
}

function handleGenerate() {
    let w = parseInt(document.getElementById('setWidth').value);
    let h = parseInt(document.getElementById('setHeight').value);
    let f = parseInt(document.getElementById('setFloors').value);
    
    let settings = {
        floors: [],
        stairs: []
    };
    
    for (let i = 0; i < f; i++) {
        settings.floors.push({
            edges: parseInt(document.querySelector(`.set-edge[data-floor="${i}"]`)?.value || 100),
            cycles: parseInt(document.querySelector(`.set-cycle[data-floor="${i}"]`)?.value || 20),
            disconnection: parseInt(document.querySelector(`.set-disc[data-floor="${i}"]`)?.value || 10)
        });
    }
    
    for (let i = 0; i < f - 1; i++) {
        settings.stairs.push(parseInt(document.querySelector(`.set-stair[data-pair="${i}"]`)?.value || 30));
    }
    
    currentMaze = new MazeGenerator(w, h, f);
    currentMaze.generate(settings);
    
    currentFloor = 0;
    renderCurrentFloor();
    
    // Вызываем заглушки, чтобы показать, что они интегрированы
    Stage2_Debug.init();
    Stage3_3D.init();
    Stage4_Controls.init();
    Stage5_UI.init();
}

function renderCurrentFloor() {
    if (!currentMaze) return;
    document.getElementById('mazeOutput').innerHTML = renderMazeConsole(currentMaze, currentFloor);
    updateHUD(currentMaze);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    generateDynamicSettings();
    
    document.getElementById('btnGenerate').addEventListener('click', handleGenerate);
    
    document.getElementById('setFloors').addEventListener('change', generateDynamicSettings);
    
    // Навигация колесиком мыши
    document.getElementById('gameField').addEventListener('wheel', (e) => {
        if (!currentMaze) return;
        e.preventDefault();
        
        if (e.deltaY < 0 && currentFloor < currentMaze.floors - 1) {
            currentFloor++;
        } else if (e.deltaY > 0 && currentFloor > 0) {
            currentFloor--;
        }
        renderCurrentFloor();
    });

    // Генерируем начальный лабиринт
    handleGenerate();
});
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

const SHAPE_TOOLS = [
  "line",
  "arrow",
  "doubleArrow",
  "rectangle",
  "circle",
  "triangle",
  "diamond",
  "star",
];

const FREEHAND_TOOLS = [
  "pen",
  "pencil",
  "highlighter",
  "eraser",
];

function getInitialName() {
  try {
    const savedName = localStorage.getItem("syncboard-user-name");

    if (savedName && savedName.trim()) {
      return savedName;
    }
  } catch (error) {
    console.error("Could not load username:", error);
  }

  return "Guest-" + Math.random().toString(36).slice(2, 6);
}

function createShape(start, end, tool, color, size) {
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;

  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);

  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  const segments = [];

  function addLine(ax, ay, bx, by) {
    segments.push({
      x1: ax,
      y1: ay,
      x2: bx,
      y2: by,
      color,
      size,
    });
  }

  if (tool === "line") {
    addLine(x1, y1, x2, y2);
  }

  if (tool === "arrow") {
    addLine(x1, y1, x2, y2);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = Math.max(size * 4, 14);

    addLine(
      x2,
      y2,
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );

    addLine(
      x2,
      y2,
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
  }

  if (tool === "doubleArrow") {
    addLine(x1, y1, x2, y2);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = Math.max(size * 4, 14);

    addLine(
      x2,
      y2,
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );

    addLine(
      x2,
      y2,
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );

    addLine(
      x1,
      y1,
      x1 + headLength * Math.cos(angle - Math.PI / 6),
      y1 + headLength * Math.sin(angle - Math.PI / 6)
    );

    addLine(
      x1,
      y1,
      x1 + headLength * Math.cos(angle + Math.PI / 6),
      y1 + headLength * Math.sin(angle + Math.PI / 6)
    );
  }

  if (tool === "rectangle") {
    addLine(left, top, right, top);
    addLine(right, top, right, bottom);
    addLine(right, bottom, left, bottom);
    addLine(left, bottom, left, top);
  }

  if (tool === "circle") {
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;
    const points = 60;

    for (let i = 0; i < points; i++) {
      const angle1 = (i / points) * Math.PI * 2;
      const angle2 = ((i + 1) / points) * Math.PI * 2;

      addLine(
        centerX + radiusX * Math.cos(angle1),
        centerY + radiusY * Math.sin(angle1),
        centerX + radiusX * Math.cos(angle2),
        centerY + radiusY * Math.sin(angle2)
      );
    }
  }

  if (tool === "triangle") {
    addLine(centerX, top, right, bottom);
    addLine(right, bottom, left, bottom);
    addLine(left, bottom, centerX, top);
  }

  if (tool === "diamond") {
    addLine(centerX, top, right, centerY);
    addLine(right, centerY, centerX, bottom);
    addLine(centerX, bottom, left, centerY);
    addLine(left, centerY, centerX, top);
  }

  if (tool === "star") {
    const points = [];

    const outerRadius =
      Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;

    const innerRadius = outerRadius * 0.4;

    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;

      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }

    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length];

      addLine(
        points[i].x,
        points[i].y,
        next.x,
        next.y
      );
    }
  }

  return segments;
}

function Whiteboard({
  boardId = "main",
  boardName = "Main Board",
  color,
  brushSize,
  tool,
  clearCanvas,

  fontSize = 20,
  textColor = "#111827",
  isBold = false,
  isItalic = false,
  isUnderline = false,


  noteColor = "#fef08a",
}) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const startPointRef = useRef(null);
  const currentStrokeRef = useRef([]);
  const previewRef = useRef(null);

  const docRef = useRef(null);
  const strokesRef = useRef(null);
  const objectsRef = useRef(null);

  const applyingRemoteRef = useRef(false);

  const historyRef = useRef([]);
  const redoRef = useRef([]);

  const toolRef = useRef(tool);
  const dragRef = useRef(null);

  const userIdRef = useRef(
    "user-" + Math.random().toString(36).slice(2, 10)
  );

  const userColorRef = useRef(
    ["#2563eb", "#e11d48", "#16a34a", "#9333ea"][
      Math.floor(Math.random() * 4)
    ]
  );

  const previousClearRef = useRef(clearCanvas);

  const [displayName, setDisplayName] = useState(getInitialName);
  const [nameInput, setNameInput] = useState(getInitialName);

  const [remoteCursors, setRemoteCursors] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [users, setUsers] = useState([]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [boardObjects, setBoardObjects] = useState([]);
  const [editingObjectId, setEditingObjectId] = useState(null);
  const [editingText, setEditingText] = useState("");

  toolRef.current = tool;

  function sendMessage(message) {
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function sendProfile(name = displayName) {
    sendMessage({
      type: "profile",
      userId: userIdRef.current,
      name,
      color: userColorRef.current,
    });
  }

  function sendActivity(activity) {
    sendMessage({
      type: "activity",
      activity,
    });
  }

  function updateHistoryButtons() {
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  }

  function renderSegments(context, segments) {
    segments.forEach((stroke) => {
      context.beginPath();

      context.moveTo(stroke.x1, stroke.y1);
      context.lineTo(stroke.x2, stroke.y2);

      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.size;
      context.lineCap = "round";
      context.lineJoin = "round";

      context.stroke();
    });
  }

  function refreshObjects() {
    const objects = objectsRef.current;

    if (objects) {
      setBoardObjects(objects.toArray());
    }
  }


  function updateBoardObject(id, changes) {
    const objects = objectsRef.current;

    if (!objects) return;

    const index = objects.toArray().findIndex(
      (item) => item.id === id
    );

    if (index === -1) return;

    const updatedObject = {
      ...objects.get(index),
      ...changes,
    };

    objects.delete(index, 1);
    objects.insert(index, [updatedObject]);
  }

  useEffect(() => {
    try {
      localStorage.setItem("syncboard-user-name", displayName);
    } catch (error) {
      console.error("Could not save username:", error);
    }

    sendProfile(displayName);
  }, [displayName]);

  useEffect(() => {
    const doc = new Y.Doc();

    const strokes = doc.getArray("strokes");
    const objects = doc.getArray("objects");

    docRef.current = doc;
    strokesRef.current = strokes;
    objectsRef.current = objects;

    const persistence = new IndexeddbPersistence(
      `syncboard-${boardId}`,
      doc
    );

    const socket = new WebSocket(
      `ws://https://syncboard-cd0p.onrender.com/sync/${encodeURIComponent(boardId)}`
    );

    socketRef.current = socket;

    function redraw() {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const context = canvas.getContext("2d");

      context.clearRect(0, 0, canvas.width, canvas.height);

      renderSegments(context, strokes.toArray());

      if (previewRef.current) {
        renderSegments(context, previewRef.current);
      }
    }

    function handleUpdate(update) {
      if (
        applyingRemoteRef.current ||
        socket.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      socket.send(
        JSON.stringify({
          type: "update",
          update: Array.from(update),
        })
      );
    }

    strokes.observe(redraw);
    objects.observe(refreshObjects);

    doc.on("update", handleUpdate);

    persistence.on("synced", () => {
      redraw();
      refreshObjects();
      console.log(`Drawing loaded for ${boardName}`);
    });

    socket.onopen = () => {
      console.log(`Connected to ${boardName}`);

      socket.send(
        JSON.stringify({
          type: "update",
          update: Array.from(Y.encodeStateAsUpdate(doc)),
        })
      );

      socket.send(
        JSON.stringify({
          type: "profile",
          userId: userIdRef.current,
          name: displayName,
          color: userColorRef.current,
        })
      );

      socket.send(
        JSON.stringify({
          type: "activity",
          activity: "Viewing",
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (
          (data.type === "sync" || data.type === "update") &&
          Array.isArray(data.update)
        ) {
          applyingRemoteRef.current = true;

          Y.applyUpdate(doc, new Uint8Array(data.update));

          applyingRemoteRef.current = false;
        }

        if (
          data.type === "users" &&
          Array.isArray(data.users)
        ) {
          setUsers(data.users);
          setOnlineUsers(data.count);
        }

        if (
          data.type === "cursor" &&
          data.userId !== userIdRef.current
        ) {
          setRemoteCursors((previous) => ({
            ...previous,
            [data.userId]: {
              x: data.x,
              y: data.y,
              color: data.color || "#2563eb",
              name: data.name || "Guest",
            },
          }));
        }

        if (data.type === "cursor-left") {
          setRemoteCursors((previous) => {
            const updated = { ...previous };
            delete updated[data.userId];
            return updated;
          });
        }
      } catch (error) {
        applyingRemoteRef.current = false;
        console.error("Sync error:", error);
      }
    };

    socket.onclose = () => {
      console.log(`Disconnected from ${boardName}`);
      setUsers([]);
      setOnlineUsers(1);
      setRemoteCursors({});
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    redraw();
    refreshObjects();

    return () => {
      doc.off("update", handleUpdate);
      strokes.unobserve(redraw);
      objects.unobserve(refreshObjects);

      socket.close();
      persistence.destroy();
      doc.destroy();

      socketRef.current = null;
      docRef.current = null;
      strokesRef.current = null;
      objectsRef.current = null;
    };
  }, [boardId, boardName]);
 
  function saveDisplayName(event) {
    event.preventDefault();

    const newName = nameInput.trim();

    if (!newName) {
      alert("Please enter your name.");
      return;
    }

    if (newName.length > 30) {
      alert("Name must be 30 characters or fewer.");
      return;
    }

    setDisplayName(newName);
    sendProfile(newName);
  }


  function getPosition(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

 
  function addBoardObject(point, objectType) {
    const objects = objectsRef.current;

    if (!objects) return;

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "object-" + Date.now() + Math.random();

    const newObject = {
      id,
      type: objectType,
      x: point.x,
      y: point.y,
      text: objectType === "note" ? "Write your note here..." : "Enter text...",
      color: textColor,
      fontSize,
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      noteColor,
      width: objectType === "note" ? 220 : 240,
      height: objectType === "note" ? 160 : 70,
    };

    objects.push([newObject]);

    setEditingObjectId(id);
    setEditingText(newObject.text);

    sendActivity(objectType === "note" ? "Adding Note" : "Adding Text");
  }

  function saveObjectText() {
    if (!editingObjectId) return;

    const objects = objectsRef.current;

    if (!objects) return;

    const index = objects.toArray().findIndex(
      (item) => item.id === editingObjectId
    );

    if (index === -1) {
      setEditingObjectId(null);
      return;
    }

    updateBoardObject(editingObjectId, {
      text: editingText,
    });

    setEditingObjectId(null);
    setEditingText("");

    sendActivity("Viewing");
  }

  function cancelObjectEditing() {
    const objects = objectsRef.current;

    if (objects && editingObjectId) {
      const index = objects.toArray().findIndex(
        (item) => item.id === editingObjectId
      );

      if (index !== -1) {
        const item = objects.get(index);

        if (!item.text || item.text === "Enter text..." ||
            item.text === "Write your note here...") {
          objects.delete(index, 1);
        }
      }
    }

    setEditingObjectId(null);
    setEditingText("");
  }
  function deleteBoardObject(id) {
    const objects = objectsRef.current;

    if (!objects) return;

    const index = objects.toArray().findIndex(
      (item) => item.id === id
    );

    if (index !== -1) {
      objects.delete(index, 1);
    }

    if (editingObjectId === id) {
      setEditingObjectId(null);
      setEditingText("");
    }
  }

  
  function startObjectDrag(event, item) {
    if (editingObjectId === item.id) return;

    if (
      event.target.closest("textarea") ||
      event.target.closest("button")
    ) {
      return;
    }

    event.preventDefault();

    dragRef.current = {
      id: item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalX: item.x,
      originalY: item.y,
    };

    sendActivity("Moving Object");
  }

  useEffect(() => {
    function handleObjectMove(event) {
      if (!dragRef.current) return;

      const drag = dragRef.current;
      const canvas = canvasRef.current;

      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const deltaX =
        (event.clientX - drag.startClientX) * scaleX;

      const deltaY =
        (event.clientY - drag.startClientY) * scaleY;

      setBoardObjects((previous) =>
        previous.map((item) =>
          item.id === drag.id
            ? {
                ...item,
                x: Math.max(
                  0,
                  Math.min(
                    1200 - item.width,
                    drag.originalX + deltaX
                  )
                ),
                y: Math.max(
                  0,
                  Math.min(
                    650 - item.height,
                    drag.originalY + deltaY
                  )
                ),
              }
            : item
        )
      );
    }

    function handleObjectUp() {
      if (!dragRef.current) return;

      const drag = dragRef.current;

      const movedObject = boardObjects.find(
        (item) => item.id === drag.id
      );

      if (movedObject) {
        updateBoardObject(drag.id, {
          x: movedObject.x,
          y: movedObject.y,
        });
      }

      dragRef.current = null;
      sendActivity("Viewing");
    }

    window.addEventListener("pointermove", handleObjectMove);
    window.addEventListener("pointerup", handleObjectUp);
    window.addEventListener("pointercancel", handleObjectUp);

    return () => {
      window.removeEventListener("pointermove", handleObjectMove);
      window.removeEventListener("pointerup", handleObjectUp);
      window.removeEventListener("pointercancel", handleObjectUp);
    };
  }, [boardObjects]);

  function startDrawing(event) {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const point = getPosition(event);
    const activeTool = toolRef.current;

    if (activeTool === "text") {
      addBoardObject(point, "text");
      return;
    }

    if (activeTool === "stickyNote") {
      addBoardObject(point, "note");
      return;
    }

    canvas.setPointerCapture(event.pointerId);

    drawingRef.current = true;

    lastPointRef.current = point;
    startPointRef.current = point;
    currentStrokeRef.current = [];
    previewRef.current = null;

    sendActivity("Drawing");
  }

  function handlePointerMove(event) {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const point = getPosition(event);

    sendMessage({
      type: "cursor",
      userId: userIdRef.current,
      x: point.x,
      y: point.y,
      color: userColorRef.current,
    });

    if (!drawingRef.current || !lastPointRef.current) {
      return;
    }

    const strokes = strokesRef.current;

    if (!strokes) return;

    const activeTool = toolRef.current;

    const strokeColor =
      activeTool === "eraser" ? "#ffffff" : color;

    let strokeSize = brushSize;

    if (activeTool === "eraser") {
      strokeSize = Math.max(brushSize * 4, 16);
    } else if (activeTool === "pencil") {
      strokeSize = Math.max(brushSize * 0.5, 1);
    } else if (activeTool === "highlighter") {
      strokeSize = brushSize * 4;
    }

    const finalColor =
      activeTool === "highlighter"
        ? color + "66"
        : strokeColor;

    if (SHAPE_TOOLS.includes(activeTool)) {
      previewRef.current = createShape(
        startPointRef.current,
        point,
        activeTool,
        strokeColor,
        strokeSize
      );

      const context = canvas.getContext("2d");

      context.clearRect(0, 0, canvas.width, canvas.height);

      renderSegments(context, strokes.toArray());
      renderSegments(context, previewRef.current);

      return;
    }

    if (!FREEHAND_TOOLS.includes(activeTool)) {
      return;
    }

    const lastPoint = lastPointRef.current;

    const newStroke = {
      x1: lastPoint.x,
      y1: lastPoint.y,
      x2: point.x,
      y2: point.y,
      color: finalColor,
      size: strokeSize,
    };

    currentStrokeRef.current.push(newStroke);

    strokes.push([newStroke]);

    lastPointRef.current = point;
  }

  function stopDrawing() {
    if (!drawingRef.current) return;

    const activeTool = toolRef.current;
    const strokes = strokesRef.current;

    if (
      SHAPE_TOOLS.includes(activeTool) &&
      previewRef.current &&
      strokes
    ) {
      const shapeSegments = previewRef.current;

      if (shapeSegments.length > 0) {
        strokes.push(shapeSegments);
        currentStrokeRef.current = shapeSegments;
      }
    }

    if (currentStrokeRef.current.length > 0) {
      historyRef.current.push({
        type: "stroke",
        segments: [...currentStrokeRef.current],
      });

      redoRef.current = [];

      updateHistoryButtons();
    }

    drawingRef.current = false;
    lastPointRef.current = null;
    startPointRef.current = null;
    currentStrokeRef.current = [];
    previewRef.current = null;

    sendActivity("Viewing");

    const canvas = canvasRef.current;

    if (canvas && strokes) {
      const context = canvas.getContext("2d");

      context.clearRect(0, 0, canvas.width, canvas.height);

      renderSegments(context, strokes.toArray());
    }
  }
  
  function undo() {
    const strokes = strokesRef.current;

    if (!strokes || historyRef.current.length === 0) {
      return;
    }

    const action = historyRef.current.pop();
    const currentStrokes = strokes.toArray();
    const indexesToDelete = [];

    action.segments.forEach((segment) => {
      for (let i = currentStrokes.length - 1; i >= 0; i--) {
        const item = currentStrokes[i];

        if (
          item.x1 === segment.x1 &&
          item.y1 === segment.y1 &&
          item.x2 === segment.x2 &&
          item.y2 === segment.y2 &&
          item.color === segment.color &&
          item.size === segment.size
        ) {
          indexesToDelete.push(i);
          currentStrokes[i] = null;
          break;
        }
      }
    });

    indexesToDelete.sort((a, b) => b - a);

    strokes.doc.transact(() => {
      indexesToDelete.forEach((index) => {
        if (index < strokes.length) {
          strokes.delete(index, 1);
        }
      });
    }, "history");

    redoRef.current.push(action);

    updateHistoryButtons();
  }

  function redo() {
    const strokes = strokesRef.current;

    if (!strokes || redoRef.current.length === 0) {
      return;
    }

    const action = redoRef.current.pop();

    strokes.doc.transact(() => {
      strokes.push(action.segments);
    }, "history");

    historyRef.current.push(action);

    updateHistoryButtons();
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const modifier = event.ctrlKey || event.metaKey;

      if (!modifier || event.altKey) return;

      if (
        event.key.toLowerCase() === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        undo();
      }

      if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
      ) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  // CLEAR BOARD
  useEffect(() => {
    if (previousClearRef.current === clearCanvas) {
      return;
    }

    previousClearRef.current = clearCanvas;

    const strokes = strokesRef.current;
    const objects = objectsRef.current;

    if (strokes && strokes.length > 0) {
      strokes.delete(0, strokes.length);
    }

    if (objects && objects.length > 0) {
      objects.delete(0, objects.length);
    }

    historyRef.current = [];
    redoRef.current = [];

    setEditingObjectId(null);
    setEditingText("");

    updateHistoryButtons();
  }, [clearCanvas]);

  function downloadBoard() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");

    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const context = exportCanvas.getContext("2d");

    context.fillStyle = "#ffffff";

    context.fillRect(
      0,
      0,
      exportCanvas.width,
      exportCanvas.height
    );

    context.drawImage(canvas, 0, 0);


    boardObjects.forEach((item) => {
      context.save();

      if (item.type === "note") {
        context.fillStyle = item.noteColor || "#fef08a";

        context.fillRect(
          item.x,
          item.y,
          item.width || 220,
          item.height || 160
        );

        context.strokeStyle = "#d4b96a";
        context.lineWidth = 1;

        context.strokeRect(
          item.x,
          item.y,
          item.width || 220,
          item.height || 160
        );
      }

      context.fillStyle = item.color || "#111827";

      let font = "";

      if (item.italic) font += "italic ";
      if (item.bold) font += "bold ";

      font += `${item.fontSize || 20}px Arial`;

      context.font = font;

      context.textBaseline = "top";

      if (item.underline) {
        context.textDecoration = "underline";
      }

      const lines = (item.text || "").split("\n");

      const lineHeight = (item.fontSize || 20) * 1.4;

      lines.forEach((line, index) => {
        context.fillText(
          line,
          item.x + 10,
          item.y + 10 + index * lineHeight,
          item.width || 220
        );

        if (item.underline) {
          const textWidth = context.measureText(line).width;

          context.beginPath();

          context.moveTo(
            item.x + 10,
            item.y + 10 + index * lineHeight + (item.fontSize || 20)
          );

          context.lineTo(
            item.x + 10 + textWidth,
            item.y + 10 + index * lineHeight + (item.fontSize || 20)
          );

          context.strokeStyle = item.color || "#111827";
          context.stroke();
        }
      });

      context.restore();
    });

    const link = document.createElement("a");

    link.download =
      boardName.replace(/[^a-z0-9-_]/gi, "-") + ".png";

    link.href = exportCanvas.toDataURL("image/png");

    document.body.appendChild(link);

    link.click();

    link.remove();
  }

  return (
    <section className="board-container">

      <div className="board-heading">
        <div>
          <span className="board-indicator"></span>
          <strong>{boardName}</strong>
        </div>

        <div className="board-actions">
          <span className="online-users">
            <span className="online-dot"></span>
            {onlineUsers} Online
          </span>

          <button
            type="button"
            className="history-button"
            onClick={undo}
            disabled={!canUndo}
          >
            ↶ Undo
          </button>

          <button
            type="button"
            className="history-button"
            onClick={redo}
            disabled={!canRedo}
          >
            ↷ Redo
          </button>

          <button
            type="button"
            className="download-button"
            onClick={downloadBoard}
          >
            ↓ Download PNG
          </button>
        </div>
      </div>

      {/* Live Participants */}
      <div className="live-users-panel">

        <div className="live-users-header">
          <div>
            <h3>Live Participants</h3>
            <p>People connected to this board</p>
          </div>

          <span className="live-count">
            🟢 {users.length} Online
          </span>
        </div>

        <form
          className="profile-form"
          onSubmit={saveDisplayName}
        >
          <input
            type="text"
            value={nameInput}
            maxLength={30}
            placeholder="Enter your display name"
            aria-label="Your display name"
            onChange={(event) =>
              setNameInput(event.target.value)
            }
          />

          <button type="submit">
            Update Name
          </button>
        </form>

        <div className="live-users-list">
          {users.map((user, index) => (
            <div
              className="live-user-card"
              key={user.userId + "-" + index}
            >
              <div
                className="live-user-avatar"
                style={{
                  backgroundColor: user.color || "#2563eb",
                }}
              >
                {(user.name || "G")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="live-user-info">
                <strong>
                  {user.name || "Guest"}

                  {user.userId === userIdRef.current
                    ? " (You)"
                    : ""}
                </strong>

                <span>
                  <i className="user-status-dot"></i>
                  {user.status || "Online"}
                </span>
              </div>

              <span className="user-activity">
                {user.activity === "Drawing"
                  ? "✏️ Drawing"
                  : user.activity === "Idle"
                    ? "💤 Idle"
                    : "👀 Viewing"}
              </span>
            </div>
          ))}

          {users.length === 0 && (
            <p className="no-live-users">
              Connecting to the board...
            </p>
          )}
        </div>
      </div>
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={1200}
          height={650}
          onPointerDown={startDrawing}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onLostPointerCapture={stopDrawing}
          className="drawing-canvas"
          aria-label="Collaborative whiteboard"
        />

     
        <div
          className="board-objects-layer"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {boardObjects.map((item) => {
            const isEditing = editingObjectId === item.id;

            return (
              <div
                key={item.id}
                onPointerDown={(event) =>
                  startObjectDrag(event, item)
                }
                style={{
                  position: "absolute",
                  left: `${(item.x / 1200) * 100}%`,
                  top: `${(item.y / 650) * 100}%`,
                  width: `${((item.width || 220) / 1200) * 100}%`,
                  minHeight: item.type === "note" ? item.height : "auto",
                  background:
                    item.type === "note"
                      ? item.noteColor || "#fef08a"
                      : "transparent",
                  border:
                    item.type === "note"
                      ? "1px solid #d4b96a"
                      : "none",
                  borderRadius: item.type === "note" ? "8px" : "0",
                  padding: item.type === "note" ? "10px" : "4px",
                  boxSizing: "border-box",
                  pointerEvents: "auto",
                  cursor: isEditing ? "text" : "move",
                  zIndex: isEditing ? 10 : 2,
                  boxShadow:
                    item.type === "note"
                      ? "0 3px 10px rgba(0,0,0,0.12)"
                      : "none",
                }}
              >
                {isEditing ? (
                  <div>
                    <textarea
                      autoFocus
                      value={editingText}
                      onChange={(event) =>
                        setEditingText(event.target.value)
                      }
                      onPointerDown={(event) =>
                        event.stopPropagation()
                      }
                      style={{
                        width: "100%",
                        minHeight:
                          item.type === "note" ? "85px" : "55px",
                        resize: "vertical",
                        border: "1px solid #94a3b8",
                        borderRadius: "5px",
                        padding: "6px",
                        boxSizing: "border-box",
                        outline: "none",
                        background: "rgba(255,255,255,0.75)",
                        color: item.color || "#111827",
                        fontSize: `${item.fontSize || 20}px`,
                        fontWeight: item.bold ? "bold" : "normal",
                        fontStyle: item.italic ? "italic" : "normal",
                        textDecoration: item.underline
                          ? "underline"
                          : "none",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        marginTop: "5px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={saveObjectText}
                        style={{
                          background: "#16a34a",
                          color: "#fff",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={cancelObjectEditing}
                        style={{
                          background: "#64748b",
                          color: "#fff",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      onDoubleClick={() => {
                        setEditingObjectId(item.id);
                        setEditingText(item.text || "");
                      }}
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        color: item.color || "#111827",
                        fontSize: `${item.fontSize || 20}px`,
                        fontWeight: item.bold ? "bold" : "normal",
                        fontStyle: item.italic ? "italic" : "normal",
                        textDecoration: item.underline
                          ? "underline"
                          : "none",
                        minHeight: "25px",
                      }}
                    >
                      {item.text}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        marginTop: "5px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingObjectId(item.id);
                          setEditingText(item.text || "");
                        }}
                        style={{
                          cursor: "pointer",
                          border: "none",
                          borderRadius: "4px",
                          padding: "3px 7px",
                          background: "#2563eb",
                          color: "white",
                          fontSize: "11px",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteBoardObject(item.id)
                        }
                        style={{
                          cursor: "pointer",
                          border: "none",
                          borderRadius: "4px",
                          padding: "3px 7px",
                          background: "#dc2626",
                          color: "white",
                          fontSize: "11px",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="cursor-layer">
          {Object.entries(remoteCursors).map(
            ([userId, cursor]) => (
              <div
                key={userId}
                className="remote-cursor"
                style={{
                  left: `${(cursor.x / 1200) * 100}%`,
                  top: `${(cursor.y / 650) * 100}%`,
                  "--cursor-color": cursor.color,
                }}
              >
                <span className="cursor-arrow">➤</span>

                <span className="cursor-label">
                  {cursor.name || userId.slice(0, 12)}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

export default Whiteboard;
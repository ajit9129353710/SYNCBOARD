function Toolbar({
  color,
  setColor,
  brushSize,
  setBrushSize,
  tool,
  setTool,
  onClear,
  fontSize,
  setFontSize,
  textColor,
  setTextColor,
  isBold,
  setIsBold,
  isItalic,
  setIsItalic,
  isUnderline,
  setIsUnderline,
  noteColor,
  setNoteColor,
}) {
  const colors = [
    "#2563eb",
    "#111827",
    "#ef4444",
    "#16a34a",
    "#9333ea",
    "#f59e0b",
    "#ec4899",
    "#0891b2",
  ];

  const drawingTools = [
    { id: "pen", icon: "✎", name: "Pen" },
    { id: "pencil", icon: "✏️", name: "Pencil" },
    { id: "highlighter", icon: "🖍️", name: "Highlight" },
    { id: "eraser", icon: "◩", name: "Eraser" },
  ];

  const shapeTools = [
    { id: "line", icon: "／", name: "Line" },
    { id: "arrow", icon: "➜", name: "Arrow" },
    { id: "doubleArrow", icon: "↔", name: "Double Arrow" },
    { id: "rectangle", icon: "▭", name: "Rectangle" },
    { id: "circle", icon: "○", name: "Circle" },
    { id: "triangle", icon: "△", name: "Triangle" },
    { id: "diamond", icon: "◇", name: "Diamond" },
    { id: "star", icon: "☆", name: "Star" },
  ];

  const textTools = [
    { id: "text", icon: "T", name: "Text" },
    { id: "stickyNote", icon: "📝", name: "Sticky Note" },
  ];

  const noteColors = [
    "#fef08a",
    "#fbcfe8",
    "#bfdbfe",
    "#bbf7d0",
    "#fed7aa",
  ];

  return (
    <div className="toolbar">

      <div className="toolbar-group">
        <h4>Drawing</h4>

        <div className="toolbar-buttons">
          {drawingTools.map((item) => (
            <button
              key={item.id}
              className={tool === item.id ? "active" : ""}
              onClick={() => setTool(item.id)}
              title={item.name}
              type="button"
            >
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar-group">
        <h4>Shapes</h4>

        <div className="toolbar-buttons">
          {shapeTools.map((item) => (
            <button
              key={item.id}
              className={tool === item.id ? "active" : ""}
              onClick={() => setTool(item.id)}
              title={item.name}
              type="button"
            >
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-group">
        <h4>Text & Notes</h4>

        <div className="toolbar-buttons">
          {textTools.map((item) => (
            <button
              key={item.id}
              className={tool === item.id ? "active" : ""}
              onClick={() => setTool(item.id)}
              title={item.name}
              type="button"
            >
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </div>
      </div>

    
      <div className="toolbar-group">
        <h4>Text Formatting</h4>

        <div className="toolbar-buttons">
          <button
            type="button"
            className={isBold ? "active" : ""}
            onClick={() => setIsBold(!isBold)}
            title="Bold"
          >
            <b>B</b>
          </button>

          <button
            type="button"
            className={isItalic ? "active" : ""}
            onClick={() => setIsItalic(!isItalic)}
            title="Italic"
          >
            <i>I</i>
          </button>

          <button
            type="button"
            className={isUnderline ? "active" : ""}
            onClick={() => setIsUnderline(!isUnderline)}
            title="Underline"
          >
            <u>U</u>
          </button>
        </div>

        <div className="toolbar-setting">
          <label>Font Size: {fontSize}px</label>

          <input
            type="range"
            min="12"
            max="60"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </div>

        <div className="toolbar-setting">
          <label>Text Color</label>

          <div className="color-options">
            {colors.map((item) => (
              <button
                key={item}
                type="button"
                className={textColor === item ? "selected" : ""}
                style={{ backgroundColor: item }}
                onClick={() => setTextColor(item)}
                title={item}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="toolbar-group">
        <h4>Sticky Note Color</h4>

        <div className="color-options">
          {noteColors.map((item) => (
            <button
              key={item}
              type="button"
              className={noteColor === item ? "selected" : ""}
              style={{ backgroundColor: item }}
              onClick={() => setNoteColor(item)}
              title={item}
            />
          ))}
        </div>
      </div>

      <div className="toolbar-group">
        <h4>Drawing Color</h4>

        <div className="color-options">
          {colors.map((item) => (
            <button
              key={item}
              type="button"
              className={color === item ? "selected" : ""}
              style={{ backgroundColor: item }}
              onClick={() => setColor(item)}
              title={item}
            />
          ))}
        </div>
      </div>

      <div className="toolbar-group">
        <h4>Custom Color</h4>

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>

   
      <div className="toolbar-group">
        <h4>Brush Size: {brushSize}px</h4>

        <input
          type="range"
          min="1"
          max="40"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </div>

      
      <div className="toolbar-group">
        <button
          type="button"
          className="clear-board-btn"
          onClick={onClear}
        >
          🗑️ Clear Board
        </button>
      </div>

    </div>
  );
}

export default Toolbar;
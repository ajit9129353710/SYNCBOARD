import { useEffect, useState } from "react";

import Toolbar from "./components/Toolbar";
import Whiteboard from "./components/Whiteboard";

import "./index.css";

const DEFAULT_BOARDS = [
  { id: "main", name: "Main Board" },
];

function createBoardId() {
  return (
    "board-" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

function getSavedBoards() {
  try {
    const saved = localStorage.getItem("syncboard-boards");

    if (saved) {
      const parsedBoards = JSON.parse(saved);

      if (Array.isArray(parsedBoards) && parsedBoards.length > 0) {
        return parsedBoards;
      }
    }
  } catch (error) {
    console.error("Error loading boards:", error);
  }

  return DEFAULT_BOARDS;
}

function getBoardIdFromURL() {
  const path = window.location.pathname;
  const prefix = "/board/";

  if (!path.startsWith(prefix)) {
    return "main";
  }

  const id = path.slice(prefix.length).split("/")[0];

  if (!id) {
    return "main";
  }

  try {
    return decodeURIComponent(id);
  } catch {
    return "main";
  }
}

function App() {
  const [boards, setBoards] = useState(getSavedBoards);
  const [boardId, setBoardId] = useState(getBoardIdFromURL);
  const [newBoardName, setNewBoardName] = useState("");

  const [color, setColor] = useState("#2563eb");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState("pen");
  const [clearCanvas, setClearCanvas] = useState(0);
 
const [fontSize, setFontSize] = useState(20);
const [textColor, setTextColor] = useState("#111827");
const [isBold, setIsBold] = useState(false);
const [isItalic, setIsItalic] = useState(false);
const [isUnderline, setIsUnderline] = useState(false);


const [noteColor, setNoteColor] = useState("#fef08a");

  const currentBoard = boards.find(
    (board) => board.id === boardId
  );

  function saveBoards(updatedBoards) {
    setBoards(updatedBoards);

    try {
      localStorage.setItem(
        "syncboard-boards",
        JSON.stringify(updatedBoards)
      );
    } catch (error) {
      console.error("Error saving boards:", error);
      alert("Could not save boards in this browser.");
    }
  }

  function openBoard(id) {
    const path =
      id === "main"
        ? "/"
        : `/board/${encodeURIComponent(id)}`;

    window.history.pushState({}, "", path);

    setBoardId(id);
    setClearCanvas(0);
    setColor("#2563eb");
    setBrushSize(4);
    setTool("pen");
  }

  function createBoard(event) {
    event.preventDefault();

    const name = newBoardName.trim();

    if (!name) {
      alert("Please enter a board name.");
      return;
    }

    const newBoard = {
      id: createBoardId(),
      name,
    };

    saveBoards([...boards, newBoard]);
    setNewBoardName("");
    openBoard(newBoard.id);
  }

  function deleteBoard(event, id) {
    event.stopPropagation();

    if (id === "main") {
      alert("Main Board cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this board?"
    );

    if (!confirmed) {
      return;
    }

    const updatedBoards = boards.filter(
      (board) => board.id !== id
    );

    saveBoards(updatedBoards);

    if (boardId === id) {
      window.history.pushState({}, "", "/");
      setBoardId("main");
      setClearCanvas(0);
    }
  }

  async function handleShareBoard() {
    const shareUrl = window.location.href;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Board link copied! Share it with your friend.");
      } else {
        window.prompt("Copy your board link:", shareUrl);
      }
    } catch (error) {
      window.prompt("Copy your board link:", shareUrl);
    }
  }

  function handleClear() {
    setClearCanvas((previous) => previous + 1);
  }

  useEffect(() => {
    function handlePopState() {
      setBoardId(getBoardIdFromURL());
      setClearCanvas(0);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const boardExists = boards.some(
      (board) => board.id === boardId
    );

    if (!boardExists) {
      window.history.replaceState({}, "", "/");
      setBoardId("main");
    }
  }, [boards, boardId]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">S</div>

          <div>
            <h1>SyncBoard</h1>
            <p>Collaborate. Create. Connect.</p>
          </div>
        </div>

        <div className="status">
          <span className="status-dot"></span>
          Multiple Boards
        </div>
      </header>

      <main className="workspace">
        <section className="welcome">
          <div>
            <span className="eyebrow">
              YOUR CREATIVE SPACE
            </span>

            <h2>Bring your ideas to life.</h2>

            <p>
              Create separate boards for meetings, designs,
              and projects. Invite others to collaborate.
            </p>
          </div>
        </section>

        <section className="boards-panel">
          <div className="boards-title">
            <div>
              <h3>Your Boards</h3>
              <p>Create and switch between boards.</p>
            </div>

            <span className="boards-count">
              {boards.length} Boards
            </span>
          </div>

          <form
            className="create-board-form"
            onSubmit={createBoard}
          >
            <input
              type="text"
              placeholder="Enter new board name..."
              value={newBoardName}
              onChange={(event) =>
                setNewBoardName(event.target.value)
              }
              maxLength={60}
              aria-label="New board name"
            />

            <button type="submit">
              + Create Board
            </button>
          </form>

          <div className="boards-list">
            {boards.map((board) => (
              <div
                key={board.id}
                className={`board-card ${
                  board.id === boardId ? "active" : ""
                }`}
              >
                <button
                  type="button"
                  className="board-card-main"
                  onClick={() => openBoard(board.id)}
                >
                  <span className="board-card-icon">▤</span>

                  <span className="board-card-info">
                    <strong>{board.name}</strong>

                    <small>
                      {board.id === boardId
                        ? "Currently open"
                        : "Open board"}
                    </small>
                  </span>
                </button>

                {board.id === boardId && (
                  <span
                    className="board-active-dot"
                    title="Current board"
                  ></span>
                )}

                {board.id !== "main" && (
                  <button
                    type="button"
                    className="delete-board"
                    title="Delete board"
                    aria-label={`Delete ${board.name}`}
                    onClick={(event) =>
                      deleteBoard(event, board.id)
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="share-board-section">
          <button
            type="button"
            className="share-board-button"
            onClick={handleShareBoard}
          >
            🔗 Share Board
          </button>
        </div>

        <Toolbar
          color={color}
          setColor={setColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          tool={tool}
          setTool={setTool}
          onClear={handleClear}
          fontSize={fontSize}
           setFontSize={setFontSize}
textColor={textColor}
setTextColor={setTextColor}
isBold={isBold}
setIsBold={setIsBold}
isItalic={isItalic}
setIsItalic={setIsItalic}
isUnderline={isUnderline}
setIsUnderline={setIsUnderline}
noteColor={noteColor}
setNoteColor={setNoteColor}
        />

        <Whiteboard
          key={boardId}
          boardId={boardId}
          boardName={currentBoard?.name || "Main Board"}
          color={color}
          brushSize={brushSize}
          tool={tool}
          clearCanvas={clearCanvas}
          fontSize={fontSize}
textColor={textColor}
isBold={isBold}
isItalic={isItalic}
isUnderline={isUnderline}
noteColor={noteColor}
        />

        <footer className="footer">
          <span>SyncBoard · Multiple Boards</span>
          <span>Made for your next big idea ✦</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
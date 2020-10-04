import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import logo from "./logo.svg";
import "./app.css";

function App() {
  const history = useHistory();
  const [roomId, setRoomId] = useState("");

  const joinRoom = (evt) => {
    evt.preventDefault();
    history.push(roomId);
  };

  function createRoom() {
    let id =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    history.push(id);
  }

  return (
    <div className="App">
      <img src={logo} className="App-logo" alt="logo" />
      <form onSubmit={joinRoom} className="Room-id-form">
        <input
          className="Room-id-input"
          placeholder="Please enter room id"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        ></input>
        <input className="Join-room-button" type="submit" value="Join" />
      </form>
      <button className="Create-room-button" onClick={createRoom}>
        Create room
      </button>
    </div>
  );
}

export default App;

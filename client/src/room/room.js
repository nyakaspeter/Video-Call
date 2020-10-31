import React, { useEffect, useState, useRef } from "react";
import { Prompt, useParams } from "react-router-dom";
import {
  MdMic,
  MdMicOff,
  MdVideocam,
  MdVideocamOff,
  MdPersonAdd,
  MdCallEnd,
} from "react-icons/md";
import io from "socket.io-client";
import Peer from "simple-peer";
import "./room.css";

function Room() {
  // Call state
  const { roomId } = useParams();
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);
  const socketRef = useRef();
  const streamRef = useRef();
  const startTime = useRef();

  // UI state
  const [{ gridWidth, videoWidth, videoHeight }, setGridLayout] = useState({
    gridWidth: 0,
    videoWidth: 0,
    videoHeight: 0,
  });
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [callTime, setCallTime] = useState(0);
  const timerRef = useRef();

  useEffect(() => {
    socketRef.current = io.connect("/");

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
        constraints: {
          video: {
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
        },
      })
      .then((stream) => {
        streamRef.current.srcObject = stream;

        socketRef.current.emit("joinRoom", roomId);

        socketRef.current.on("otherUsersInRoom", (users) => {
          const peerObjs = [];
          users.forEach((userId) => {
            const peer = createPeer(userId, socketRef.current.id, stream);
            peersRef.current.push({
              peerId: userId,
              peer,
            });
            peerObjs.push({
              peerId: userId,
              peer,
            });
          });
          setPeers(peerObjs);
          recalculateLayout();

          console.log("Other users in room:", users);
        });

        socketRef.current.on("startTimer", (time) => {
          startTime.current = time;

          timerRef.current = setInterval(() => {
            setCallTime(new Date().getTime() - startTime.current);
          }, 1000);
        });

        socketRef.current.on("userJoined", (payload) => {
          const peer = addPeer(payload.signal, payload.userId, stream);

          const peerObj = {
            peerId: payload.userId,
            peer,
          };

          peersRef.current.push(peerObj);
          setPeers([...peersRef.current]);
          recalculateLayout();

          console.log("User joined the room:", payload.userId);
        });

        socketRef.current.on("signalReceived", (payload) => {
          const item = peersRef.current.find((p) => p.peerId === payload.id);
          item.peer.signal(payload.signal);
        });

        socketRef.current.on("userLeft", (id) => {
          const peerObj = peersRef.current.find((p) => p.peerId === id);
          if (peerObj) {
            peerObj.peer.destroy();
          }
          const peerObjs = peersRef.current.filter((p) => p.peerId !== id);

          peersRef.current = peerObjs;
          setPeers(peerObjs);
          recalculateLayout();

          console.log("User left the room:", id);
        });
      });

    function createPeer(userToSignal, userId, stream) {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream,
      });

      peer.on("signal", (signal) => {
        socketRef.current.emit("signal", {
          userToSignal,
          userId,
          signal,
        });
      });

      return peer;
    }

    function addPeer(incomingSignal, userId, stream) {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream,
      });

      peer.on("signal", (signal) => {
        socketRef.current.emit("signalBack", { signal, userId });
      });

      peer.signal(incomingSignal);

      return peer;
    }

    window.addEventListener("resize", recalculateLayout);

    return () => {
      window.removeEventListener("resize", recalculateLayout);
    };
  }, [roomId]);

  function copyAddressToClipboard() {
    navigator.clipboard.writeText(window.location.href);
    //TODO: Toast
  }

  function toggleCam() {
    streamRef.current.srcObject.getVideoTracks()[0].enabled = !streamRef.current.srcObject.getVideoTracks()[0]
      .enabled;
    setCamEnabled(!camEnabled);
  }

  function toggleMic() {
    streamRef.current.srcObject.getAudioTracks()[0].enabled = !streamRef.current.srcObject.getAudioTracks()[0]
      .enabled;
    setMicEnabled(!micEnabled);
  }

  function disconnectFromRoom() {
    clearInterval(timerRef.current);
    socketRef.current.close();
    streamRef.current.srcObject.getTracks().forEach((track) => {
      track.stop();
    });
    peersRef.current = [];
    setPeers([]);
  }

  function callTimeToString() {
    var hours = Math.floor(callTime / 3600000);
    var minutes = Math.floor((callTime - hours * 3600000) / 60000);
    var seconds = Math.floor(
      (callTime - hours * 3600000 - minutes * 60000) / 1000
    );

    var hoursText = "";
    var minutesText = minutes + ":";
    var secondsText = seconds.toString();

    if (hours > 0) {
      hoursText = hours + ":";
    }
    if (minutes < 10) {
      minutesText = "0" + minutes + ":";
    }
    if (seconds < 10) {
      secondsText = "0" + seconds;
    }
    return hoursText + minutesText + secondsText;
  }

  function recalculateLayout() {
    const aspectRatio =
      peersRef.current.length === 1
        ? window.innerWidth / window.innerHeight
        : 4 / 3;
    const videoCount = peersRef.current.length;
    const containerHeight = window.innerHeight;
    const containerWidth = window.innerWidth;

    let bestLayout = {
      area: 0,
      cols: 0,
      rows: 0,
      width: 0,
      height: 0,
    };

    for (let cols = 1; cols <= videoCount; cols++) {
      const rows = Math.ceil(videoCount / cols);
      const hScale = containerWidth / (cols * aspectRatio);
      const vScale = containerHeight / rows;
      let width;
      let height;
      if (hScale <= vScale) {
        width = Math.floor(containerWidth / cols);
        height = Math.floor(width / aspectRatio);
      } else {
        height = Math.floor(containerHeight / rows);
        width = Math.floor(height * aspectRatio);
      }
      const area = width * height;
      if (area > bestLayout.area) {
        bestLayout = {
          area,
          width,
          height,
          rows,
          cols,
        };
      }
    }

    setGridLayout({
      gridWidth: bestLayout.width * bestLayout.cols,
      videoWidth: bestLayout.width,
      videoHeight: bestLayout.height,
    });
  }

  return (
    <>
      <div className="Room" id="Grid">
        <div className="Grid" style={{ maxWidth: gridWidth + "px" }}>
          {peers.map((peer) => {
            return (
              <PeerVideo
                key={peer.peerId}
                peer={peer.peer}
                width={videoWidth}
                height={videoHeight}
              />
            );
          })}
        </div>

        <UserVideo streamRef={streamRef} camEnabled={camEnabled} />

        <div className="Call-time">{callTimeToString()}</div>

        <div className="Buttons-container">
          <button onClick={copyAddressToClipboard} className="Button">
            <MdPersonAdd />
          </button>
          <button className="Button" onClick={toggleCam}>
            {camEnabled ? <MdVideocam /> : <MdVideocamOff />}
          </button>
          <button className="Button" onClick={toggleMic}>
            {micEnabled ? <MdMic /> : <MdMicOff />}
          </button>
          <button
            className="Button Endcall-button"
            onClick={disconnectFromRoom}
          >
            <MdCallEnd />
          </button>
        </div>
      </div>

      <Prompt when={true} message={() => disconnectFromRoom()} />
    </>
  );
}

const UserVideo = (props) => {
  const [circleView, setCircleView] = useState(true);

  return (
    <div
      className="User-video-container"
      style={
        circleView
          ? { width: "72px", height: "72px", borderRadius: "36px" }
          : { height: "144px", borderRadius: "8px" }
      }
    >
      <video
        onClick={() => setCircleView(!circleView)}
        className="Video"
        playsInline
        autoPlay
        muted
        ref={props.streamRef}
        style={
          props.camEnabled
            ? circleView
              ? {}
              : { width: "initial", objectFit: "contain" }
            : { display: "none" }
        }
      />
    </div>
  );
};

const PeerVideo = (props) => {
  const ref = useRef();
  const [fillContainer, setFillContainer] = useState(true);

  useEffect(() => {
    props.peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [props.peer]);

  return ref.srcObject ? (
    <></>
  ) : (
    <div
      className="Peer-video-container"
      style={{
        width: props.width + "px",
        height: props.height + "px",
      }}
    >
      <video
        onClick={() => setFillContainer(!fillContainer)}
        className="Video"
        playsInline
        autoPlay
        ref={ref}
        style={fillContainer ? {} : { objectFit: "contain" }}
      />
    </div>
  );
};

export default Room;

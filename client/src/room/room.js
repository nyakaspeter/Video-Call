import React, { useEffect, useState, useRef } from "react";
import { Prompt, useParams } from "react-router-dom";
import { CopyToClipboard } from "react-copy-to-clipboard";
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

const PeerVideo = (props) => {
  const ref = useRef();

  useEffect(() => {
    props.peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [props.peer]);

  return ref.srcObject ? (
    <></>
  ) : (
    <video className="Video" playsInline autoPlay ref={ref} />
  );
};

function Room() {
  const { roomId } = useParams();
  const [callTime, setCallTime] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);
  const socketRef = useRef();
  const streamRef = useRef();
  const connectedRef = useRef();
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

          console.log("Other users in room:", users);
        });

        socketRef.current.on("userJoined", (payload) => {
          const peer = addPeer(payload.signal, payload.userId, stream);

          const peerObj = {
            peerId: payload.userId,
            peer,
          };

          peersRef.current.push(peerObj);
          setPeers([...peersRef.current]);

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

        onConnected();
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

        onConnected();
      });

      peer.signal(incomingSignal);

      return peer;
    }

    function onConnected() {
      if (!connectedRef.current) {
        console.log(`Connected to room: ${roomId}`);
        connectedRef.current = true;
        timerRef.current = setInterval(() => {
          setCallTime((callTime) => callTime + 1);
        }, 1000);
      }
    }
  }, [roomId]);

  function disconnectFromRoom() {
    clearInterval(timerRef.current);
    socketRef.current.close();
    streamRef.current.srcObject.getTracks().forEach((track) => {
      track.stop();
    });
    peersRef.current = [];
    setPeers([]);
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

  function showCopiedToClipboard() {
    //TODO: Toast
  }

  function callTimeToString() {
    var hours = Math.floor(callTime / 3600);
    var minutes = Math.floor((callTime - hours * 3600) / 60);
    var seconds = callTime - hours * 3600 - minutes * 60;

    var hoursText = "";
    var minutesText = `${minutes}`;
    var secondsText = `${seconds}`;

    if (hours > 0) {
      hoursText = `${hours}:`;
    }
    if (minutes < 10) {
      minutesText = "0" + minutes + ":";
    }
    if (seconds < 10) {
      secondsText = "0" + seconds;
    }
    return hoursText + minutesText + secondsText;
  }

  return (
    <>
      <Prompt
        when={true}
        message={() => {
          socketRef.current.close();
          streamRef.current.srcObject.getTracks().forEach((track) => {
            track.stop();
          });
        }}
      ></Prompt>
      <div className="Room">
        <div className="Video-grid">
          {peers.map((peer) => {
            return (
              <div
                key={peer.peerId}
                style={{
                  flex: `0 0 ${100 / (peers.length > 3 ? 3 : peers.length)}%`,
                }}
                className="Video-container"
              >
                <PeerVideo peer={peer.peer} />
              </div>
            );
          })}
        </div>

        <div
          className="User-video-container"
          style={
            camEnabled ? { height: "72px", width: "72px" } : { height: "0" }
          }
        >
          <video
            className="User-video"
            playsInline
            autoPlay
            muted
            ref={streamRef}
            height={camEnabled ? 72 : 0}
          />
        </div>

        <div className="Toolbar">
          <CopyToClipboard
            text={window.location.href}
            onCopy={() => showCopiedToClipboard()}
          >
            <button className="Toolbar-button">
              <MdPersonAdd />
            </button>
          </CopyToClipboard>
          <button className="Toolbar-button" onClick={toggleCam}>
            {camEnabled ? <MdVideocam /> : <MdVideocamOff />}
          </button>
          <button className="Toolbar-button" onClick={toggleMic}>
            {micEnabled ? <MdMic /> : <MdMicOff />}
          </button>
          <button
            className="Toolbar-button Endcall-button"
            onClick={disconnectFromRoom}
          >
            <MdCallEnd />
          </button>
        </div>

        <div className="Call-time">{callTimeToString()}</div>
      </div>
    </>
  );
}

export default Room;

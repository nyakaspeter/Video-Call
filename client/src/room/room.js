import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { CopyToClipboard } from "react-copy-to-clipboard";
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
    <video className="Peer-video" playsInline autoPlay ref={ref} />
  );
};

function Room() {
  let { id } = useParams();
  const [roomIdText, setRoomIdText] = useState("Room id: " + id);

  function showCopiedToClipboard() {
    let text = roomIdText;
    setRoomIdText("Copied room id to clipboard!");
    setTimeout(setRoomIdText.bind(text, text), 2000);
  }

  const [peers, setPeers] = useState([]);
  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);

  useEffect(() => {
    socketRef.current = io.connect("/");
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        socketRef.current.emit("join room", id);
        socketRef.current.on("all users", (users) => {
          const peers = [];
          users.forEach((userID) => {
            const peer = createPeer(userID, socketRef.current.id, stream);
            peersRef.current.push({
              peerID: userID,
              peer,
            });
            peers.push(peer);
          });
          setPeers(peers);
        });

        socketRef.current.on("user joined", (payload) => {
          const peer = addPeer(payload.signal, payload.callerID, stream);
          peersRef.current.push({
            peerID: payload.callerID,
            peer,
          });

          setPeers((users) => [...users, peer]);
        });

        socketRef.current.on("receiving returned signal", (payload) => {
          const item = peersRef.current.find((p) => p.peerID === payload.id);
          item.peer.signal(payload.signal);
        });
      });
  }, [id]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("sending signal", {
        userToSignal,
        callerID,
        signal,
      });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("returning signal", { signal, callerID });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  return (
    <div className="Room">
      <div className="Video-grid">
        <video
          className="User-video"
          playsInline
          autoPlay
          muted
          ref={userVideo}
        />

        {peers.map((peer, index) => {
          return <PeerVideo key={index} peer={peer} />;
        })}
      </div>

      <CopyToClipboard text={id} onCopy={() => showCopiedToClipboard()}>
        <button className="Room-id-button">{roomIdText}</button>
      </CopyToClipboard>
    </div>
  );
}

export default Room;

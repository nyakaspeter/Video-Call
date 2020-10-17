import React, { useEffect, useState, useRef } from "react";
import { Prompt, useParams } from "react-router-dom";
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
  const peersRef = useRef([]);
  const socketRef = useRef();
  const userVideo = useRef();

  useEffect(() => {
    socketRef.current = io.connect("/");
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;

        socketRef.current.emit("joinRoom", id);

        socketRef.current.on("otherUsersInRoom", (users) => {
          const peers = [];
          users.forEach((userId) => {
            const peer = createPeer(userId, socketRef.current.id, stream);
            peersRef.current.push({
              peerID: userId,
              peer,
            });
            peers.push({
              peerID: userId,
              peer,
            });
          });
          setPeers(peers);

          console.log("Other users in room:", users);
        });

        socketRef.current.on("userJoined", (payload) => {
          const peer = addPeer(payload.signal, payload.callerID, stream);
          peersRef.current.push({
            peerID: payload.callerID,
            peer,
          });

          const peerObj = {
            peerID: payload.callerID,
            peer,
          };

          setPeers((users) => [...users, peerObj]);

          console.log("User joined the room:", payload.callerID);
        });

        socketRef.current.on("receiving returned signal", (payload) => {
          const item = peersRef.current.find((p) => p.peerID === payload.id);
          item.peer.signal(payload.signal);
        });

        socketRef.current.on("userLeft", (id) => {
          const peerObj = peersRef.current.find((p) => p.peerID === id);
          if (peerObj) {
            peerObj.peer.destroy();
          }
          const peers = peersRef.current.filter((p) => p.peerID !== id);
          peersRef.current = peers;
          setPeers(peers);

          console.log("User left the room:", id);
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
    <>
      <Prompt
        when={true}
        message={() => {
          socketRef.current.destroy();
          userVideo.current.srcObject
            .getTracks()
            .forEach((track) => track.stop());
          peersRef.current.forEach((peer) => {
            console.log(peer.peer);
          });
        }}
      ></Prompt>
      <div>
        <div className="Video-grid">
          {peers.map((peer) => {
            return (
              <div className="Peer-video-container">
                <PeerVideo key={peer.peerID} peer={peer.peer} />
              </div>
            );
          })}
        </div>

        <video
          className="User-video"
          playsInline
          autoPlay
          muted
          ref={userVideo}
        />

        {/* <CopyToClipboard text={id} onCopy={() => showCopiedToClipboard()}>
        <button className="Room-id-button">{roomIdText}</button>
      </CopyToClipboard> */}
      </div>
    </>
  );
}

export default Room;
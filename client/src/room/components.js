import React, { useEffect, useState, useRef } from "react";

export const UserVideo = (props) => {
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
  
  export const PeerVideo = (props) => {
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
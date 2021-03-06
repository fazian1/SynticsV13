import React, { Component } from 'react'
import io from 'socket.io-client'
import faker from "faker"

import {IconButton, Badge, Input, Button} from '@material-ui/core'
import VideocamIcon from '@material-ui/icons/Videocam'
import VideocamOffIcon from '@material-ui/icons/VideocamOff'
import MicIcon from '@material-ui/icons/Mic'
import MicOffIcon from '@material-ui/icons/MicOff'
import ScreenShareIcon from '@material-ui/icons/ScreenShare'
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare'
import CallEndIcon from '@material-ui/icons/CallEnd'
import ChatIcon from '@material-ui/icons/Chat'

import { message } from 'antd'
import 'antd/dist/antd.css'

import { Row } from 'reactstrap'
import Modal from 'react-bootstrap/Modal'
//import 'bootstrap/dist/css/bootstrap.css'
import "./Video.css"

const server_url = process.env.NODE_ENV === 'production' ? 'https://syntics.co' : "https://syntics.co"

var connections = {}
const peerConnectionConfig = {
	'iceServers': [
		// { 'urls': 'stun:stun.services.mozilla.com' },
		{ 'urls': 'stun:stun.l.google.com:19302' },
	]
}
var socket = null
var socketId = null
var elms = 0

class VideoForTeacher extends Component {
	constructor(props) {
		super(props)

		this.localVideoref = React.createRef()

		this.videoAvailable = false
		this.audioAvailable = false

		this.state = {
			countForWindow : 0,
			defaultState : false,
			windowClose : false,
			video: false,
			audio: false,
			screen: false,
			showModal: false,
			screenAvailable: false,
			messages: [],
			message: "",
			raiseHandMessage: "Raised their hand",
			newmessages: 0,
			askForUsername: true,
			username: '',
			userNameArray: []
		}
		connections = {}

		this.getPermissions()
	}

	componentDidMount(){
		if(this.state.windowClose === false){
			var myWindow = window.open("/teacher/facerecognition", "", "width=200,height=100");
			this.state.countForWindow = + 1
			console.log(this.state.countForWindow)
			this.state.raiseHandMessage  = "Raised their hand for Question"
		}
	}
	getPermissions = async () => {
		try{
			await navigator.mediaDevices.getUserMedia({ video: true })
				.then(() => this.videoAvailable = true)
				.catch(() => this.videoAvailable = false)

			await navigator.mediaDevices.getUserMedia({ audio: true })
				.then(() => this.audioAvailable = true)
				.catch(() => this.audioAvailable = false)

			if (navigator.mediaDevices.getDisplayMedia) {
				this.setState({ screenAvailable: true })
			} else {
				this.setState({ screenAvailable: false })
			}

			if (this.videoAvailable || this.audioAvailable) {
				navigator.mediaDevices.getUserMedia({ video: this.videoAvailable, audio: this.audioAvailable })
					.then((stream) => {
						window.localStream = stream
						this.localVideoref.current.srcObject = stream
					})
					.then((stream) => {})
					.catch((e) => console.log(e))
			}
		} catch(e) { console.log(e) }
	}

	getMedia = () => {
		this.setState({
			video: this.videoAvailable,
			audio: this.audioAvailable
		}, () => {
			this.getUserMedia()
			this.connectToSocketServer()
		})
	}

	getUserMedia = () => {
		this.setState({defaultState : true})
		if ((this.state.video && this.videoAvailable) || (this.state.audio && this.audioAvailable)) {
			navigator.mediaDevices.getUserMedia({ video: this.state.video, audio: this.state.audio })
				.then(this.getUserMediaSuccess)
				.then((stream) => {})
				.catch((e) => console.log(e))
		} else {
			try {
				let tracks = this.localVideoref.current.srcObject.getTracks()
				tracks.forEach(track => track.stop())
			} catch (e) {}
		}
	}

	getUserMediaSuccess = (stream) => {
		try {
			window.localStream.getTracks().forEach(track => track.stop())
		} catch(e) { console.log(e) }

		window.localStream = stream
		this.localVideoref.current.srcObject = stream

		for (let id in connections) {
			if (id === socketId) continue

			connections [id].addStream(window.localStream)

			connections[id].createOffer().then((description) => {
				connections[id].setLocalDescription(description)
					.then(() => {
						socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
					})
					.catch(e => console.log(e))
			})
		}

		stream.getTracks().forEach(track => track.onended = () => {
			this.setState({
				video: false,
				audio: false,
			}, () => {
				try {
					let tracks = this.localVideoref.current.srcObject.getTracks()
					tracks.forEach(track => track.stop())
				} catch(e) { console.log(e) }

				let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()])
				window.localStream = blackSilence()
				this.localVideoref.current.srcObject = window.localStream

				for (let id in connections) {
					connections[id].addStream(window.localStream)

					connections[id].createOffer().then((description) => {
						connections[id].setLocalDescription(description)
							.then(() => {
								socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
							})
							.catch(e => console.log(e))
					})
				}
			})
		})
	}
	
	getDislayMedia = () => {
		if (this.state.screen) {
			if (navigator.mediaDevices.getDisplayMedia) {
				navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
					.then(this.getDislayMediaSuccess)
					.then((stream) => {})
					.catch((e) => console.log(e))
			}
		}
	}

	getDislayMediaSuccess = (stream) => {
		try {
			window.localStream.getTracks().forEach(track => track.stop())
		} catch(e) { console.log(e) }

		window.localStream = stream
		this.localVideoref.current.srcObject = stream

		for (let id in connections) {
			if (id === socketId) continue

			connections[id].addStream(window.localStream)

			connections[id].createOffer().then((description) => {
				connections[id].setLocalDescription(description)
					.then(() => {
						socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
					})
					.catch(e => console.log(e))
			})
		}

		stream.getTracks().forEach(track => track.onended = () => {
			this.setState({
				screen: false,
			}, () => {
				try {
					let tracks = this.localVideoref.current.srcObject.getTracks()
					tracks.forEach(track => track.stop())
				} catch(e) { console.log(e) }

				let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()])
				window.localStream = blackSilence()
				this.localVideoref.current.srcObject = window.localStream

				this.getUserMedia()
			})
		})
	}

	gotMessageFromServer = (fromId, message) => {
		var signal = JSON.parse(message)

		if (fromId !== socketId) {
			if (signal.sdp) {
				connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
					if (signal.sdp.type === 'offer') {
						connections[fromId].createAnswer().then((description) => {
							connections[fromId].setLocalDescription(description).then(() => {
								socket.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
							}).catch(e => console.log(e))
						}).catch(e => console.log(e))
					}
				}).catch(e => console.log(e))
			}

			if (signal.ice) {
				connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
			}
		}
	}

	changeCssVideos = (main) => {
		let widthMain = main.offsetWidth
		let minWidth = "30%"
		if ((widthMain * 30 / 100) < 300) {
			minWidth = "300px"
		}
		let minHeight = "40%"

		let height = String(100 / elms) + "%"
		let width = ""
		if(elms === 0 || elms === 1) {
			width = "100%"
			height = "100%"
		} else if (elms === 2) {
			width = "45%"
			height = "100%"
		} else if (elms === 3 || elms === 4) {
			width = "35%"
			height = "50%"
		} else {
			width = String(100 / elms) + "%"
		}

		let videos = main.querySelectorAll("video")
		for (let a = 0; a < videos.length; ++a) {
			videos[a].style.minWidth = minWidth
			videos[a].style.minHeight = minHeight
			videos[a].style.setProperty("width", width)
			videos[a].style.setProperty("height", height)
		}

		return {minWidth, minHeight, width, height}
	}

	connectToSocketServer = () => {
		socket = io.connect(server_url, { secure: true })

		socket.on('signal', this.gotMessageFromServer)

		socket.on('connect', () => {
			socket.emit('join-call', window.location.href)
			socketId = socket.id

			socket.on('chat-message', this.addMessage)

			socket.on('newuser-addition', this.addingNewUser)


			socket.on('user-left', (id) => {
				let video = document.querySelector(`[data-socket="${id}"]`)
				if (video !== null) {
					elms--
					video.parentNode.removeChild(video)

					let main = document.getElementById('main')
					this.changeCssVideos(main)
				}
			})

			socket.on('user-joined', (id, clients) => {
				clients.forEach((socketListId) => {
					connections[socketListId] = new RTCPeerConnection(peerConnectionConfig)
					// Wait for their ice candidate       
					connections[socketListId].onicecandidate = function (event) {
						if (event.candidate != null) {
							socket.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
						}
					}

					// Wait for their video stream
					connections[socketListId].onaddstream = (event) => {
						// TODO mute button, full screen button
						var searchVidep = document.querySelector(`[data-socket="${socketListId}"]`)
						if (searchVidep !== null) { // if i don't do this check it make an empyt square
							searchVidep.srcObject = event.stream
						} else {
							elms = clients.length
							let main = document.getElementById('main')
							let cssMesure = this.changeCssVideos(main)

							let video = document.createElement('video')

							let css = {minWidth: cssMesure.minWidth, minHeight: cssMesure.minHeight, maxHeight: "100%", margin: "10px",
								 objectFit: "fill"}
							for(let i in css) video.style[i] = css[i]

							video.style.setProperty("width", cssMesure.width)
							video.style.setProperty("height", cssMesure.height)
							video.setAttribute('data-socket', socketListId)
							video.srcObject = event.stream
							video.autoplay = true
							video.playsinline = true

							main.appendChild(video)
						}
					}

					// Add the local video stream
					if (window.localStream !== undefined && window.localStream !== null) {
						connections[socketListId].addStream(window.localStream)
					} else {
						let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()])
						window.localStream = blackSilence()
						connections[socketListId].addStream(window.localStream)
					}
				})

				if (id === socketId) {
					for (let id2 in connections) {
						if (id2 === socketId) continue
						
						try {
							connections[id2].addStream(window.localStream)
						} catch(e) {}
			
						connections[id2].createOffer().then((description) => {
							connections[id2].setLocalDescription(description)
								.then(() => {
									socket.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
								})
								.catch(e => console.log(e))
						})
					}
				}
			})
		})
	}

	silence = () => {
		let ctx = new AudioContext()
		let oscillator = ctx.createOscillator()
		let dst = oscillator.connect(ctx.createMediaStreamDestination())
		oscillator.start()
		ctx.resume()
		return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
	}
	black = ({ width = 640, height = 480 } = {}) => {
		let canvas = Object.assign(document.createElement("canvas"), { width, height })
		canvas.getContext('2d').fillRect(0, 0, width, height)
		let stream = canvas.captureStream()
		return Object.assign(stream.getVideoTracks()[0], { enabled: false })
	}

	handleVideo = () => this.setState({ video: !this.state.video }, () => this.getUserMedia())
	handleAudio = () => this.setState({ audio: !this.state.audio }, () => this.getUserMedia())
	handleScreen = () => this.setState({ screen: !this.state.screen }, () => this.getDislayMedia())

	handleEndCall = () => {
		try {
			let tracks = this.localVideoref.current.srcObject.getTracks()
			tracks.forEach(track => track.stop())
		} catch (e) {}
		window.location.href = "/"
	}

	openChat = () => this.setState({ showModal: true, newmessages: 0 })
	closeChat = () => this.setState({ showModal: false })
	handleMessage = (e) => this.setState({ message: e.target.value })


	addingNewUser = (newUser, sender, socketIdSender) => {
		this.setState(prevState => ({
			userNameArray: [...prevState.userNameArray, { "sender": sender, "data": newUser }],
		}))
		console.log(this.state.userNameArray)
	}
	addMessage = (data, data2, sender, socketIdSender) => {

		
		if (this.state.raiseHandMessage != ""){

			this.setState(prevState => ({
				messages: [...prevState.messages, { "sender": sender, "data": data2 }],
			}))
			this.setState({raiseHandMessage: ""})
		
		}
		else{
			this.setState(prevState => ({

				messages: [...prevState.messages, { "sender": sender, "data": data }],
			
			}))
	
			if (socketIdSender !== socketId) {
				this.setState({ newmessages: this.state.newmessages + 1 })
			}
		}
	
	}

	handleUsername = (e) => {
		
		this.setState({ username: e.target.value })
		//this.state.userNameArray.push(this.state.username)
		
		/*
		this.setState(prevState => ({
			userNameArray: [...prevState.userNameArray, {"username": this.state.username}],
		}))
		*/

	}

	sendMessage = () => {
		
		socket.emit('chat-message', this.state.message, this.state.raiseHandMessage, this.state.username)
		
		//socket.emit('chat-message', this.state.message, this.state.username)
		
		console.log(this.state.message, "testing Value")
		
		this.setState({ message: "",  sender: this.state.username })
		
		//this.setState({ message: "", sender: this.state.username })
		
		console.log(this.state.message, "testing Next")
	}

	sendRaiseHandAlert = () => {
		//socket.emit('chat-message', this.state.message, this.state.raiseHandMessage, this.state.username)
		
		socket.emit('newuser-addition', this.state.raiseHandMessage, this.state.username)
		
		console.log(this.state.raiseHandMessage, "testing Value")
		
		//this.setState({ raiseHandMessage: "", sender: this.state.username })
		
		this.setState({ message: "", sender: this.state.username })
		
		console.log(this.state.raiseHandMessage, "testing Next")
	}

	handleSendingMessage = () => {
		
		//this.setState({ raiseHandMessage: "Testing" })
		this.setState({ message: "Raise Hand" })
		console.log(this.state.message)
		
		//this.sendRaiseHandAlert()
		
		this.sendMessage()
		
	}

	copyUrl = () => {
		let text = window.location.href
		if (!navigator.clipboard) {
			let textArea = document.createElement("textarea")
			textArea.value = text
			document.body.appendChild(textArea)
			textArea.focus()
			textArea.select()
			try {
				document.execCommand('copy')
				message.success("Link copied to clipboard!")
			} catch (err) {
				message.error("Failed to copy")
			}
			document.body.removeChild(textArea)
			return
		}
		navigator.clipboard.writeText(text).then(function () {
			message.success("Link copied to clipboard!")
		}, () => {
			message.error("Failed to copy")
		})
	}

	connect = () => {
		/*
		this.setState({
			userNameArray: [...this.state.userNameArray, this.state.username]
		  })
		*/
		
		
		this.setState({ askForUsername: false }, () => this.getMedia())
	}

	isChrome = function () {
		let userAgent = (navigator && (navigator.userAgent || '')).toLowerCase()
		let vendor = (navigator && (navigator.vendor || '')).toLowerCase()
		let matchChrome = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null
		// let matchFirefox = userAgent.match(/(?:firefox|fxios)\/(\d+)/)
		// return matchChrome !== null || matchFirefox !== null
		return matchChrome !== null
	}
	
	render() {
		if(this.isChrome() === false){
			return (
				<div style={{background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "400px",
						textAlign: "center", margin: "auto", marginTop: "50px", justifyContent: "center"}}>
					<h1>Sorry, this works only with Google Chrome</h1>
				</div>
			)
		}
		return (
			<div>
				{this.state.askForUsername === true ?
					<div>
						<div style={{background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "400px",
								textAlign: "center", margin: "auto", marginTop: "50px", justifyContent: "center"}}>
							<p style={{ margin: 0, fontWeight: "bold", paddingRight: "50px" }}>Set your username</p>
							<Input placeholder="Username" value={this.state.username} onChange={e => this.handleUsername(e)} />
							<Button variant="contained" color="primary" onClick={this.connect} style={{ margin: "20px" }}>Connect</Button>
						</div>

						<div style={{ justifyContent: "center", textAlign: "center", paddingTop: "40px" }}>
						<video id="my-video" ref={this.localVideoref} autoPlay muted style={{
									margin: "10px",objectFit: "cover",
									width: "300px",height: "400px"}}></video>
						</div>
					</div>
					:
					<div >
						{this.state.defaultState === false ? 
						
						<div class="main_video">
						{this.state.video = false}
						
						{/* this.state.video = false will false the vidoe by default */}
						<Modal show={this.state.showModal} onHide={this.closeChat} style={{ zIndex: "999999" }}>
							<Modal.Header closeButton>
								<Modal.Title>Chat Room</Modal.Title>
							</Modal.Header>
							<Modal.Body style={{ overflow: "auto", overflowY: "auto", height: "400px", textAlign: "left" }} >
								{this.state.messages.length > 0 ? this.state.messages.map((item, index) => (
									<div key={index} style={{textAlign: "left"}}>
										<p style={{ wordBreak: "break-all" }}><b>{item.sender}</b>: {item.data}</p>
									</div>
								)) : <p>No message yet</p>}
							</Modal.Body>
							<Modal.Footer className="div-send-msg">
								<Input placeholder="Message" value={this.state.message} onChange={e => this.handleMessage(e)} />
								<Button variant="contained" color="primary" onClick={this.sendMessage}>Send</Button>
							</Modal.Footer>
						</Modal>
						
						<div class="main__left">
							<div class="main__videos">
								<div id="video-grid">
								<Row id="main" className="flex-container" style={{ margin: 0, padding: 0 }}>
								
								<video id="my-video" ref={this.localVideoref} autoPlay muted style={{
									margin: "10px",objectFit: "cover",
									width: "300px",height: "400px"}}></video>
								</Row>
								</div>

							</div>
							<div class="main__controls">
							<div class="main__controls__block">
								<div onClick = {this.handleVideo} class="main__controls__button main__video_button" >
									{(this.state.video === true) ? 
									<div className='text-center'>
										<b><i class="fas fa-video"></i></b>
										<br />
										<b><span>Stop Video</span></b>
									</div>
										: 
									<div className='text-center'> 
										<b><i class="stop_video fas fa-video-slash"></i></b>
										<br />
										<b><span>Play Video</span></b>
									</div>
									}
								</div>

								<div onClick={this.handleAudio} class="main__controls__button main__mute_button">
								{this.state.audio === true ? 
									<div className='text-center'>
										<b><i class="fas fa-microphone"></i></b>
										<br />
										<b><span>Mute</span></b>
									</div>
								: 
									<div className='text-center'>
										<b><i class="unmute_video fas fa-microphone-slash"></i></b>
										<br />
										<b><span>Unmute</span></b>
									</div>
								}
								</div>
								<div onClick={this.handleSendingMessage} class="main__controls__button">
								
									<div className='text-center'>
										<b><i class="far fa-hand-paper"></i></b>
										<br />
										<b><span>Raise Hand</span></b>
									</div>
					
								</div>
							</div>
							<div class="main__controls__block">
								<div class="main__controls__button" onClick={this.handleEndCall}>
									<b><span class="leave_meeting">Leave Meeting</span></b>
								</div>
							</div>
						</div>	
						</div>
						<div class="main__right">
							<div class="main__header">
								<h6 className='text-white'>Chat</h6>
							</div>
							<div class="main__chat_window">
								<ul class="messages">
								{this.state.messages.length > 0 ? this.state.messages.map((item, index) => (
									<div key={index} style={{textAlign: "left"}}>
										<p style={{ wordBreak: "break-all" }}><b>{item.sender}</b>: {item.data}</p>
									</div>
								)) : <p>No message yet</p>}
								</ul>
								
							</div>
							<div class="main__message_container">
								<input type = "text" placeholder="Type message here..." value={this.state.message} onChange={e => this.handleMessage(e)}  />
								<Button variant="contained" color="primary" onClick={this.sendMessage}>Send</Button>
							</div>
						</div>
						{/*}
						<div className="">
							<div style={{ paddingTop: "20px" }}>
								
								
							</div>

							<Row id="main" className="flex-container" style={{ margin: 0, padding: 0 }}>
							<video id="my-video" ref={this.localVideoref} autoPlay muted style={{
									margin: "10px",objectFit: "cover",
									width: "300px",height: "400px"}}></video>
							</Row>
						</div>
							*/}
						
			
						{/*}
						<div >
							<IconButton style={{ color: "#f44336" }} onClick={this.handleEndCall}>
								<CallEndIcon />
							</IconButton>

							<IconButton style={{ color: "#424242" }} onClick={this.handleAudio}>
								{this.state.audio === true ? <MicIcon /> : <MicOffIcon />}
							</IconButton>


							<Badge badgeContent={this.state.newmessages} max={999} color="secondary" onClick={this.openChat}>
								<IconButton style={{ color: "#424242" }} onClick={this.openChat}>
									<ChatIcon />
								</IconButton>
							</Badge>
						</div>
							*/}
						</div>
	
				
						
						:
						<div class="main_video">
													{/* this.state.video = false will false the vidoe by default */}
						{/*}
						<div className="btn-down" style={{ backgroundColor: "whitesmoke", color: "whitesmoke", textAlign: "center" }}>
							<IconButton style={{ color: "#424242" }} onClick={this.handleVideo}>
								{(this.state.video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
							</IconButton>

							<IconButton style={{ color: "#f44336" }} onClick={this.handleEndCall}>
								<CallEndIcon />
							</IconButton>

							<IconButton style={{ color: "#424242" }} onClick={this.handleAudio}>
								{this.state.audio === true ? <MicIcon /> : <MicOffIcon />}
							</IconButton>


							<Badge badgeContent={this.state.newmessages} max={999} color="secondary" onClick={this.openChat}>
								<IconButton style={{ color: "#424242" }} onClick={this.openChat}>
									<ChatIcon />
								</IconButton>
							</Badge>
						</div>
							*/}

						
						<div class="main__left">
							<div class="main__videos">
								<div id="video-grid">
								<Row id="main"  className="flex-container" style={{ margin: 0, padding: 0 }} >
								
								<video id="my-video" ref={this.localVideoref} autoPlay muted style={{
									margin: "10px",objectFit: "cover",
									width: "300px",height: "400px"}}>
								</video>
								</Row>
								</div>
							</div>
							<div class="main__controls">
							<div class="main__controls__block">
								<div onClick = {this.handleVideo} class="main__controls__button main__video_button" >
									{(this.state.video === true) ? 
									<div className='text-center' style={{fontWeight:'bold'}}>
										<i class="fas fa-video"></i>
										<br />
										<span>Stop Video</span>
									</div>
										: 
									<div className='text-center' style={{fontWeight:'bold'}}>
										<i class="stop_video fas fa-video-slash"></i>
										<br />
										<span>Play Video</span>
									</div>
									}
								</div>

								<div onClick={this.handleAudio} class="main__controls__button main__mute_button">
								{this.state.audio === true ? 
									<div className='text-center' style={{fontWeight:'bold'}}>
										<i class="fas fa-microphone"></i>
										<br />
										<span>Mute</span>
									</div>
								: 
									<div className='text-center' style={{fontWeight:'bold'}}>
										<i class="unmute_video fas fa-microphone-slash"></i>
										<br />
										<span>Unmute</span>
									</div>
								}
								</div>
							</div>
							<div onClick={this.handleSendingMessage} class="main__controls__button">
								
								<div className='text-center'>
									<b><i class="far fa-hand-paper"></i></b>
									<br />
									<b><span>Raise Hand</span></b>
								</div>
				
							</div>
							<div class="main__controls__block">
								<div class="main__controls__button" onClick={this.handleEndCall}>
									<b><span class="leave_meeting">Leave Meeting</span></b>
								</div>
							</div>
						</div>
					</div>
					<div class="main__right">
							<div class="main__header">
								<h6 className='text-white'>Chat</h6>
							</div>

							<div class="main__chat_window">
								<ul class="messages">
								{this.state.messages.length > 0 ? this.state.messages.map((item, index) => (
									<div key={index} style={{textAlign: "left"}}>
										<p style={{ wordBreak: "break-all", color:"white", paddingLeft:"10px"  }}><b >{item.sender}</b>: {item.data}</p>
									</div>
								)) : <p></p>}
								</ul>
								
							</div>
							<div class="main__message_container">
								<Input placeholder="Type message here..." value={this.state.message} onChange={e => this.handleMessage(e)} className ="outline-white"/>	
								<Button variant="contained" color="primary" onClick={this.sendMessage}>Send</Button>
							</div>
						</div>
						

				{/*}
						<div className="">
							<div style={{ paddingTop: "20px" }}>
								
								
							</div>


						</div>
          */}
		  				
						

					</div>
					}
					
					</div>
				}
			</div>
		)
	}
}

export default VideoForTeacher
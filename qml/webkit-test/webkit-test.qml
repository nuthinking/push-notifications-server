import QtQuick 1.0

import QtWebKit 1.0

/*

  To control it, open a web page to: http://protonode.gabon.webfactional.com/?clientName=remote

*/

Rectangle
{
    id: app
    width: 360
    height: 360
    property int messageId: -1

    Text {
        text: app.messageId
        anchors.centerIn: parent
    }
    MouseArea {
        anchors.fill: parent
        onClicked: {
            Qt.quit();
        }
    }

    function callthis(id){
        app.messageId = id;
        console.log("got message: " + id);
    }

    WebView {
        id: webview
        url: "http://protonode.gabon.webfactional.com/?clientName=prototype"
        preferredWidth: 800
        preferredHeight: 600
        //scale: 0.5
        smooth: false
        visible: false

        javaScriptWindowObjects: QtObject {
             WebView.windowObjectName: "qml"

             function addMessage(str) {
                 app.callthis(str)
             }
         }


    }
}


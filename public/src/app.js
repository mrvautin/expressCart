import React from'react';
import ReactDOM from'react-dom';
import Menu from'./components/Menu.jsx';

function run(){
    const root = document.getElementById('menu');
    ReactDOM.render(<Menu {...(JSON.parse(root.dataset.menu))} />, root);
};

const loadedStates = ['complete', 'loaded', 'interactive'];

if(loadedStates.includes(document.readyState) && document.body){
    run();
}else{
    window.addEventListener('DOMContentLoaded', run, false);
}

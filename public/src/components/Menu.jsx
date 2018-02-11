import React from'react';

export default class Menu extends React.Component{
    render(){
        console.log(this.props);
        return(
            <nav className="navbar navbar-default navbarMenuWrapper">
                <div className="container-fluid">
                    <div className="col-md-8 col-md-offset-2 navbarMenu">
                        <ul className="nav navbar-nav">
                            {Object.keys(this.props.menu.items).map((key, value) => {
                                let className = '';
                                if(this.props.searchTerm && this.props.searchTerm === this.props.menu.items[key].title){
                                    className = 'navActive';
                                }
                                return<li className="{className}" key={key}><a href="/category/{this.props[key].link}">{this.props.menu.items[key].title}</a></li>
                            })}
                            <li className="pull-right col-md-4 searchBarWrapper">
                                <div className="search-bar-input input-group searchMenuLocation- searchProPerRow-">
                                    <input type="text" name="frm_search" id="frm_search" className="form-control" placeholder="Search the shop" />
                                    <span className="input-group-btn">
                                        <button className="btn btn-primary" id="btn_search" type="submit">Search</button>
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        );
    }
}

const _ = require('lodash');
const {config} = require("dotenv");
const { getConfig } = require('../lib/config');
const ObjectId = require('mongodb').ObjectID;
const Config = getConfig()

const getMenu = async (db, language) => {
    let menu;
    if (language) menu = await db.menu.findOne({language: language});

    if(!menu) menu = await db.menu.findOne({language: Config.defaultLocale});
    if(!menu) menu = await db.menu.findOne({language: {$exists: false}});
    return menu;
};

const getMenuById = async (db,id) => {
    return await db.menu.findOne({_id: ObjectId(id)});
}

const getMenus = async (db) => (await db.menu.find({}).toArray());

// creates a new menu item
const newMenu = (req) => {
    const db = req.app.db;
    return getMenu(db,req.body.language)
    .then(async (menu) => {
        // if no menu present
        if (!menu) {
            menu = {};
            menu.items = [];
        }
        const newNav = {
            id : `${new Date().valueOf()}`,
            title: req.body.navMenu,
            link: req.body.navLink,
            order: Object.keys(menu.items).length + 1
        };

        menu.items.push(newNav);
        try{
            if (menu._id && (menu.language || (req.body.language === Config.defaultLocale))) {
                await db.menu.updateOne({_id: menu._id}, {$set: {items: menu.items}})
            } else {
                await db.menu.insertOne({items: menu.items, language: req.body.language})
            }
            return true;
        }catch(e){
            return false;
        }


    })
    .catch((err) => {
        console.log('Error creating new menu', err);
        return false;
    });
};

// delete a menu item
const deleteMenu = (req, menuIndex) => {
    const db = req.app.db;
    return getMenuById(db,req.body.mongoId)
    .then((menu) => {
        // Remove menu item
        menu.items = menu.items.filter(x => x.id !==menuIndex);
        return db.menu.updateOne({_id : menu._id}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

// updates and existing menu item
const updateMenu = (req) => {
    const db = req.app.db;
    return getMenu(db,req.body.language)
    .then((menu) => {
        // find menu item and update it
        const menuIndex = _.findIndex(menu.items, ['id', req.body.navId]);
        menu.items[menuIndex].title = req.body.navMenu;
        menu.items[menuIndex].link = req.body.navLink;
        const updateQuery = {language : req.body.language}

        return db.menu.updateOne(updateQuery, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

const sortMenu = (menu) => {
    if(menu && menu.items){
        menu.items = _.sortBy(menu.items, 'order');
        return menu;
    }
    return {};
};

// orders the menu
const orderMenu = async (req, res) => {
    const db = req.app.db;
    const menuId = req.body.menuId;
    return await getMenuById(db,menuId)
        .then((menu) => {
            const menuOrder = req.body['order[]'];
            // update the order
            const existingIds = menu.items.map(x => x.id);
            const menuOrderOnlyExistingIds = menuOrder.filter(x => existingIds.includes(x));
            for (let i = 0; i < menuOrderOnlyExistingIds.length; i++) {
                _.find(menu.items, ['id', menuOrderOnlyExistingIds[i]]).order = i;
            }
            return db.menu.updateOne({_id:ObjectId(menuId)}, {$set: {items: menu.items}}, {upsert: true})
                .then(() => {
                    return true;
                });
        })
        .catch((e) => {
            console.error(e);
            return false;
        });
};

module.exports = {
    getMenu,
    getMenuById,
    getMenus,
    newMenu,
    deleteMenu,
    updateMenu,
    sortMenu,
    orderMenu
};

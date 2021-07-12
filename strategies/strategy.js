const { pressEnterToContinue } = require("../modules/enterToContinue")

class Strategy {
    constructor(props) {
        this.initialized = false
        this.props = props
    }

    async run() {
        console.log('Override me in yourCustomStrategy.js!')
        await pressEnterToContinue()
    }

    //all strategies have contract available in their params
    static params = {
        contract: 'object'
    }
}

module.exports = { Strategy }
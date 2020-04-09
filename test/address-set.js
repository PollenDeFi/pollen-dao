const MockAddressSetWrapper = artifacts.require('MockAddressSetWrapper');
const { expect } = require('chai');

const address0 = '0x0000000000000000000000000000000000000000';
const address1 = '0x0000000000000000000000000000000000000001';
const address2 = '0x0000000000000000000000000000000000000002';
const address3 = '0x0000000000000000000000000000000000000003';

contract('addressSet', function (accounts) {
    beforeEach(async function () {
        this.addressSet = await MockAddressSetWrapper.new();
    });

    it('should return false when adding address 0x0', async function () {
        const result = await this.addressSet.add.call(address0);
        expect(result).to.be.false;
    });

    it('should return false when adding an element already added', async function () {
        await this.addressSet.add(address1);
        const result = await this.addressSet.add.call(address1);
        expect(result).to.be.false;
    });

    it('should return false when removing an element not added', async function () {
        const result = await this.addressSet.remove.call(address1);
        expect(result).to.be.false;
    });

    it('should return true when adding an element not added', async function () {
        const result = await this.addressSet.add.call(address1);
        expect(result).to.be.true;
    });

    it('should return true when removing an element already added', async function () {
        await this.addressSet.add(address1);
        const result = await this.addressSet.remove.call(address1);
        expect(result).to.be.true;
    });

    it('should contain correct elements when adding and removing elements', async function () {
        let result = await this.addressSet.contains(address1);
        expect(result).to.be.false;
        await this.addressSet.add(address1);
        result = await this.addressSet.contains(address1);
        expect(result).to.be.true;
        let elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address1]);

        await this.addressSet.remove(address1);
        result = await this.addressSet.contains(address1);
        expect(result).to.be.false;
        elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address0]);

        await this.addressSet.add(address1);
        result = await this.addressSet.contains(address1);
        expect(result).to.be.true;
        elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address0, address1]);

        await this.addressSet.add(address2);
        result = await this.addressSet.contains(address1);
        expect(result).to.be.true;
        result = await this.addressSet.contains(address2);
        expect(result).to.be.true;
        elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address0, address1, address2]);

        await this.addressSet.remove(address1);
        result = await this.addressSet.contains(address1);
        expect(result).to.be.false;
        result = await this.addressSet.contains(address2);
        expect(result).to.be.true;
        elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address0, address0, address2]);

        result = await this.addressSet.contains(address3);
        expect(result).to.be.false;
        await this.addressSet.add(address3);
        result = await this.addressSet.contains(address3);
        expect(result).to.be.true;
        elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address0, address0, address2, address3]);

        await this.addressSet.remove(address3);
        result = await this.addressSet.contains(address3);
        expect(result).to.be.false;
        elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address0, address0, address2, address0]);

        await this.addressSet.add(address3);
        result = await this.addressSet.contains(address3);
        expect(result).to.be.true;
        elements = await this.addressSet.getElements();
        expect(elements).to.be.eql([address0, address0, address2, address0, address3]);
    });
});

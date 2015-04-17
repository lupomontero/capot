var assert = require('assert');
var Task = require('../../server/task');


describe('capot/server/task', function () {

  it('should emit start event when task doc added', function (done) {
    var changeListener;
    var capotMock = {
      changes: {
        on: function (ev, listener) {
          assert.equal(ev, 'change');
          changeListener = listener;
        }
      }
    };

    Task(capotMock, function () {
      capotMock.task.on('start', function (dbName, taskDoc) {
        assert.equal(dbName, 'some/db');
        assert.equal(taskDoc.id, 'xxx');
        assert.equal(taskDoc._rev, '1-aa');
        assert.equal(taskDoc.type, '$foo');
        done();
      });

      process.nextTick(function () {
        changeListener('some/db', {
          results: [
            { id: '$foo/xxx', doc: { _id: '$foo/xxx', _rev: '1-aa', type: '$foo' } }
          ]
        });
      });
    });
  });

});


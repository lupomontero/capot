var assert = require('assert');
var Task = require('../../server/task');


describe('capot/server/task', function () {

  it('should emit start event when task doc added', function (done) {
    var changeListener;
    var serverMock = {
      app: {
        changes: {
          on: function (ev, listener) {
            assert.equal(ev, 'change');
            changeListener = listener;
          }
        }
      }
    };

    Task.register(serverMock, {}, function () {
      serverMock.app.task.on('start', function (dbName, taskDoc) {
        assert.equal(dbName, 'some/db');
        assert.equal(taskDoc.id, 'xxx');
        assert.equal(taskDoc._rev, '1-aa');
        assert.equal(taskDoc.type, '$foo');
        done();
      });

      process.nextTick(function () {
        changeListener('some/db', {
          id: '$foo/xxx',
          doc: { _id: '$foo/xxx', _rev: '1-aa', type: '$foo' }
        });
      });
    });
  });

});


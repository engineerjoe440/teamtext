import json
import logging

from teamtext.logger import CustomLogger, InterceptHandler


def test_load_logging_config_reads_json_file(tmp_path):
    config_path = tmp_path / "log_conf.json"
    config_data = {
        "logger": {
            "path": str(tmp_path / "app.log"),
            "level": "info",
            "rotation": "1 day",
            "retention": "7 days",
            "format": "{message}",
        }
    }
    config_path.write_text(json.dumps(config_data), encoding="utf-8")

    loaded = CustomLogger.load_logging_config(config_path)

    assert loaded == config_data


def test_make_logger_uses_config_and_returns_bound_logger(tmp_path):
    config_path = tmp_path / "log_conf.json"
    log_file = tmp_path / "app.log"
    config_data = {
        "logger": {
            "path": str(log_file),
            "level": "info",
            "rotation": "1 day",
            "retention": "7 days",
            "format": "{message}",
        }
    }
    config_path.write_text(json.dumps(config_data), encoding="utf-8")

    configured_logger = CustomLogger.make_logger(config_path)

    configured_logger.info("logger smoke test")
    assert configured_logger is not None


def test_intercept_handler_emit_accepts_standard_record():
    handler = InterceptHandler()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello from record",
        args=(),
        exc_info=None,
    )

    handler.emit(record)

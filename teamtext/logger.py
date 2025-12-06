################################################################################
"""
BetterPix
---------

(c) 2025 - Stanley Solutions - License: AGPL

Authors:
    - Joe Stanley
    - Nathan Church

This application serves to provide backend services for a React.js photo upload
system that can be used by volunteers and youth to engage with event photos.
"""
################################################################################

import logging
import sys
import json
from pathlib import Path
from loguru import logger


class InterceptHandler(logging.Handler):
    """Handle Logging Interceptions."""

    loglevel_mapping = {
        50: 'CRITICAL',
        40: 'ERROR',
        30: 'WARNING',
        20: 'INFO',
        10: 'DEBUG',
        0: 'NOTSET',
    }

    def emit(self, record: logging.LogRecord):
        try:
            level = logger.level(record.levelname).name
        except AttributeError:
            level = self.loglevel_mapping[record.levelno]

        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        log = logger.bind(request_id='app')
        log.opt(
            depth=depth,
            exception=record.exc_info
        ).log(level, record.getMessage())


class CustomLogger:
    """Use Additional Logging Configurations."""

    @classmethod
    def make_logger(cls, config_path: Path):
        """Create the Logger as Needed."""
        config = cls.load_logging_config(config_path)
        logging_config = config.get('logger')

        # pylint: disable-next=redefined-outer-name
        logger = cls.customize_logging(
            logging_config.get('path') ,
            level=logging_config.get('level'),
            retention=logging_config.get('retention'),
            rotation=logging_config.get('rotation'),
            format=logging_config.get('format')
        )
        return logger

    @classmethod
    def customize_logging(cls,
            filepath: Path,
            level: str,
            rotation: str,
            retention: str,
            format: str, # pylint: disable=redefined-builtin
    ):
        """Customize the Logging."""
        logger.remove()
        logger.add(
            sys.stdout,
            enqueue=True,
            backtrace=True,
            level=level.upper(),
            format=format
        )
        logger.add(
            str(filepath),
            rotation=rotation,
            retention=retention,
            enqueue=True,
            backtrace=True,
            level=level.upper(),
            format=format
        )
        logging.basicConfig(handlers=[InterceptHandler()], level=0)
        logging.getLogger("uvicorn.access").handlers = [InterceptHandler()]
        for _log in [
            'uvicorn',
            'uvicorn.error',
            'fastapi'
        ]:
            _logger = logging.getLogger(_log)
            _logger.handlers = [InterceptHandler()]

        return logger.bind(request_id=None, method=None)


    @classmethod
    def load_logging_config(cls, config_path):
        """Load the Logging Configuration."""
        config = None
        with open(config_path, encoding="utf-8") as config_file:
            config = json.load(config_file)
        return config
